import S3 from './s3';
import { exec } from 'teen_process';
import { fs } from 'appium-support';
import logger from '../lib/logger';
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
    logger.error(`Could not upload ${app} to TestObject. Log into https://app.staging.testobject.org/ and verify that ${app} has been uploaded manually.
      The API call to /api/storage/upload re-uploads apps. It doesn't upload them the first time: (${e})`);
    throw e;
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
      logger.debug(`Setting caps.testobject_remote_appium_url to ${appiumZipUrl}`);
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
 * Uploads zip to S3 and overrides WD to use TO objects
 */
TestObject.enableTestObject = async function (wd, appiumDir) {
  appiumDir = appiumDir || process.env.PWD; // Default to PWD if no appium directory provided
  logger.debug(`Uploading '${appiumDir}' to S3`);
  let appiumS3Object;
  try {
    appiumS3Object = await S3.uploadZip(appiumDir);
  } catch (e) {
    logger.error(`Could not upload ${appiumDir} to S3. Reason: (${e.message})`);
    throw e;
  }

  // Overriding WD so it uses the appiumS3Object.Location
  return {
    wdOverride: TestObject.overrideWD(wd, appiumS3Object.Location),
    appiumS3Object,
    wd,
  };
};

/**
 * Takes the object that was returned by enableTestObject and uses it to restore WD
 * and delete the zip from S3
 */
TestObject.disableTestObject = async function ({wdOverride, appiumS3Object, wd}) {
  TestObject.restoreWD(wd, wdOverride);
  await S3.deleteZip(appiumS3Object.Key);
};

export default TestObject;
