import zip from './s3';
// import { exec } from 'teen_process';
import { fs } from 'appium-support';
import log from '../lib/logger';
import request from 'request-promise';
import _ from 'lodash';

const TestObject = {};

TestObject.DEFAULT_DEVICE = 'HTC_One_M8_real';
TestObject.DEFAULT_IOS_DEVICE = 'iPad_2_16GB_real';

/**
 * Takes desired capabilities and extends it with testobject capabilities
 */
TestObject.getTestObjectCaps = async function (caps = {}) {
  // Upload the app to TestObject
  let testobject_app_id;
  try {
    testobject_app_id = await TestObject.uploadTestObjectApp(caps.app);
  } catch (e) {
    throw new Error(`Could not upload ${caps.app} to TestObject: ${e.message}`);
  }

  // Determine the TestObject_device
  let testobject_device;
  if (process.env.TESTOBJECT_DEVICE) {
    testobject_device = process.env.TESTOBJECT_DEVICE;
  } else if (caps.platformName && caps.platformName.toLowerCase() === 'ios') {
    testobject_device = TestObject.DEFAULT_IOS_DEVICE;
  } else {
    testobject_device = TestObject.DEFAULT_DEVICE;
  }

  // Extend the provided caps with special testobject caps 
  // (see https://app.staging.testobject.org/#/danielgraham/contact-manager/appium/basic/instructions)
  return  Object.assign(caps, {
    testobject_app_id,
    testobject_device,
    testobject_appium_version: '1.6.0',
    testobject_api_key: process.env.TESTOBJECT_API_KEY,
    testobject_cache_device: true,
  });
};

TestObject._appIdCache = {};

// Make request-promise mockable
TestObject.request = request;

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
  // TODO: Blocked on TestObject fixing this
  /*const appId = await exec('curl', [
    '-u', `"${process.env.TESTOBJECT_USERNAME}:${process.env.TESTOBJECT_API_KEY}"`,
    '-X', 'POST', 'https://app.staging.testobject.org:443/api/storage/upload',
    '-H', '"Content-Type: application/octet-stream"',
    '---data-binary', `@${app}`,
  ]);*/
  const appId = null;

  TestObject._appIdCache[app] = {
    id: appId,
    uploaded: +(new Date()),
  };

  return appId;
};

TestObject.MOCHA_TESTOBJECT_TIMEOUT = 10 * 60 * 1000; // Ten minutes

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
    driver = await originalPromiseChainRemote(testObjectParams);

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
 * Mocha 'before' and 'after' functions that upload appium directory and app to TestObject
 * and override 'wd' to point HOST and PORT to TestObject and add caps
 */
TestObject.usingTestObject = function (wd, appiumDir = process.env.PWD) {
  let appiumS3Object, wdOverrides;

  if(!this || !this.timeout || !_.isFunction(this.timeout)) {
    throw new Error('Method "usingTestObject" must be called with mocha context');
  }
  this.timeout(TestObject.MOCHA_TESTOBJECT_TIMEOUT);

  before(async function () { // jshint ignore:line
    log.info('Setting timeout to', TestObject.MOCHA_TESTOBJECT_TIMEOUT);
    this.timeout(TestObject.MOCHA_TESTOBJECT_TIMEOUT); // Set a long timeout because we're uploading a large file to s3
    log.info('process.env.TESTOBJECT===true: Running tests on TestObject');
    log.info(`Uploading ${appiumDir} to S3`);
    appiumS3Object = await zip.uploadZip(appiumDir);
    log.info(`Done uploading ${appiumDir} to S3`);
    wdOverrides = TestObject.overrideWD(wd, appiumS3Object.Location);
  });

  after(async function () { // jshint ignore:line
    log.info(`Deleting ${appiumDir} from S3`);
    await zip.deleteZip(appiumS3Object.Key);
    log.info(`Deleted ${appiumDir} from S3`);
    TestObject.restoreWD(wd, wdOverrides);
  });
};

export default TestObject;