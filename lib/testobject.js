import zip from './s3';
import { exec } from 'teen_process';
import { fs } from 'appium-support';
import log from '../lib/logger';
import _ from 'lodash';

const TestObject = {};

TestObject.DEFAULT_DEVICE = 'Samsung_I9505_Galaxy_S4_real';
TestObject.DEFAULT_IOS_DEVICE = 'iPad_2_16GB_real';

/**
 * Takes desired capabilities and extends it with testobject capabilities
 */
TestObject.getTestObjectCaps = async function (caps = {}) {
  // Upload the app to TestObject
  let testobjectAppId;
  try {
    testobjectAppId = await TestObject.uploadTestObjectApp(caps.app);
  } catch (e) {
    throw new Error(`Could not upload ${caps.app} to TestObject: ${e.message}`);
  }

  // Determine the TestObject_device
  let testobjectDevice;
  if (process.env.TESTOBJECT_DEVICE) {
    testobjectDevice = process.env.TESTOBJECT_DEVICE;
  } else if (caps.platformName && caps.platformName.toLowerCase() === 'ios') {
    testobjectDevice = TestObject.DEFAULT_IOS_DEVICE;
  } else {
    testobjectDevice = TestObject.DEFAULT_DEVICE;
  }

  // Extend the provided caps with special testobject caps 
  // (see https://app.staging.testobject.org/#/danielgraham/contact-manager/appium/basic/instructions)
  return  Object.assign({
    testobject_app_id: testobjectAppId,
    testobject_device: testobjectDevice,
    testobject_api_key: process.env.TESTOBJECT_API_KEY,
    testobject_cache_device: true,
  }, caps);
};

TestObject._appIdCache = {};


/**
 * Uploads your app (.app, .apk, .ipa etc...) to TestObject server
 */
TestObject.uploadTestObjectApp = async function (app) {
  if (!process.env.TESTOBJECT_API_KEY) {
    throw new Error('Must provide TESTOBJECT_API_KEY in environment variables');
  }
  if (!process.env.TESTOBJECT_USERNAME) {
    throw new Error('Must define TESTOBJECT_USERNAME in environment variables');
  }

  // If this app was already uploaded and hasn't changed since last upload, re-use the app id
  const cache = TestObject._appIdCache[app];
  if (cache) {
    const {mtime} = await fs.stat(app);
    const modifiedTime = +(new Date(mtime));
    if (modifiedTime < cache.uploaded) {
      return cache.id;
    }
  }

  // Upload the app
  // (see https://app.staging.testobject.org/#/danielgraham/contact-manager/appium/basic/instructions)
  try {
    const {stdout:appId, stderr} = (await exec('curl', [
      '-u',  `${process.env.TESTOBJECT_USERNAME}:${process.env.TESTOBJECT_API_KEY}`,
      '-X', 'POST', 'https://app.staging.testobject.org:443/api/storage/upload',
      '-H', 'Content-Type: application/octet-stream',
      '--data-binary', `@${app}`,
    ]));

    if (!appId && stderr) {
      throw new Error(stderr);
    }

    TestObject._appIdCache[app] = {
      id: appId,
      uploaded: +(new Date()),
    };
    return appId;
  } catch (e) {
    console.error(`Could not upload ${app} to TestObject. Log into https://app.staging.testobject.org/ and verify that ${app} has been uploaded manually. 
      The API call to /api/storage/upload re-uploads apps. It doesn't upload them the first time: (${e})`);
  }
};

TestObject.MOCHA_TESTOBJECT_TIMEOUT = 30 * 60 * 1000; // Half an hour limit

TestObject.HOST = 'app.staging.testobject.org';
TestObject.PORT = 443;

/**
 * Overrides the WD (admc/wd) prototype to force it to use TestObject
 */
TestObject.overrideWD = function (wd, appiumZipUrl) {
  const originalPromiseChainRemote = wd.promiseChainRemote;

  // Override the 'promiseChainRemote' method to use TestObject HOST and special caps
  wd.promiseChainRemote = async function (...args) {
    let testObjectParams = {
      host: TestObject.HOST,
      port: TestObject.PORT,
      https: true,
    };
    let driver;
    if (_.isObject(args[0])) {
      testObjectParams = Object.assign(args[0], testObjectParams);
    }
    driver = await originalPromiseChainRemote.call(wd, testObjectParams);

    const originalInit = driver.init;
    driver.init = async function (caps, ...args) {
      const extendedCaps = await TestObject.getTestObjectCaps(caps);
      extendedCaps.testobject_remote_appium_url = appiumZipUrl;
      return await originalInit.call(driver, extendedCaps, ...args);
    };
    return driver;
  };
  
  return originalPromiseChainRemote;
};

/**
 * Undo the overrides done in WD
 */
TestObject.restoreWD = function (wd, originalPromiseChainRemote) {
  wd.promiseChainRemote = originalPromiseChainRemote;
};

/**
 * Adds before/after hooks to mocha
 * 
 * Uploads 
 * 
 */
TestObject.addTestObjectMochaHooks = async function (appiumDir) {
  let appiumS3Object = await zip.uploadZip(appiumDir);

  before(async function () { // jshint ignore:line
    console.log('Setting timeout to', TestObject.MOCHA_TESTOBJECT_TIMEOUT);
    this.timeout(TestObject.MOCHA_TESTOBJECT_TIMEOUT); // Set a long timeout because we're uploading a large file to s3
    console.log('process.env.TESTOBJECT===true: Running tests on TestObject');
    console.log(`Uploading ${appiumDir} to S3`);
    console.log(`Done uploading ${appiumDir} to S3`);
  });

  after(async function () { // jshint ignore:line
    console.log(`Deleting ${appiumDir} from S3`);
    await zip.deleteZip(appiumS3Object.Key);
    console.log(`Deleted ${appiumDir} from S3`);
  });

  return appiumS3Object;
};

/**
 * Mocha 'before' and 'after' functions that upload appium directory and app to TestObject
 * and override 'wd' to point HOST and PORT to TestObject and add caps
 */
TestObject.usingTestObject = function (wd, appiumDir) {
  appiumDir = appiumDir || process.env.PWD; // Default to PWD if no appium directory provided
  let wdOverrides;

  if(!this || !this.timeout || !_.isFunction(this.timeout)) {
    throw new Error('Method "usingTestObject" must be called with mocha context');
  }
  this.timeout(TestObject.MOCHA_TESTOBJECT_TIMEOUT);

  const appiumS3Object = TestObject.addTestObjectMochaHooks(appiumDir);

  before(async function () { // jshint ignore:line
    wdOverrides = TestObject.overrideWD(wd, appiumS3Object.Location);
  });

  after(async function () { // jshint ignore:line
    TestObject.restoreWD(wd, wdOverrides);
  });
};

export default TestObject;