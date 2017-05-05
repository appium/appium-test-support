import zip from './s3';
import { exec } from 'teen_process';
import { fs } from 'appium-support';

const TestObject = {};

TestObject.DEFAULT_DEVICE = 'HTC_One_M8_real';
TestObject.DEFAULT_IOS_DEVICE = 'iPad_2_16GB_real';

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
    testobject_api_key: process.env.TESTOBJECT_API_KEY,
    testobject_cache_device: true,
  });
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
  const appId = await exec('curl', [
    '-u', `"${process.env.TESTOBJECT_USERNAME}:${process.env.TESTOBJECT_API_KEY}"`,
    '-X', 'POST', 'https://app.staging.testobject.org:443/api/storage/upload',
    '-H', '"Content-Type: application/octet-stream"',
    '---data-binary', `@${app}`,
  ]);

  TestObject._appIdCache[app] = {
    id: appId,
    uploaded: +(new Date()),
  };

  return appId;
};

TestObject.MOCHA_TESTOBJECT_TIMEOUT = 10 * 60 * 1000; // Ten minutes

TestObject.HOST = 'app.staging.testobject.org';

/**
 * Mocha 'before' and 'after' functions that upload appium directory and app to TestObject
 * and override 'wd' to point HOST and PORT to TestObject and add caps
 */
TestObject.usingTestObject = function (wd, appiumDir) {
  let res, wdOverrides;
  //let wdInitStub, wdPromiseChainRemoteStub;

  before(async function () { // jshint ignore:line
    console.log('Setting timeout to', TestObject.MOCHA_TESTOBJECT_TIMEOUT);
    this.timeout(TestObject.MOCHA_TESTOBJECT_TIMEOUT); // Set a long timeout because we're uploading a large file to s3
    console.log('process.env.TESTOBJECT===true: Running tests on TestObject');
    console.log(`Uploading ${process.env.PWD} to S3`);
    res = await zip.uploadZip(appiumDir || process.env.PWD);
    console.log(`Done uploading ${process.env.PWD} to S3`);
    wdOverrides = TestObject.overrideWD(wd);
  });

  after(async function () { // jshint ignore:line
    console.log(`Deleting ${process.env.PWD} from S3`);
    await zip.deleteZip(res.Key);
    console.log(`Deleted ${process.env.PWD} from S3`);
    TestObject.restoreWD(wd, wdOverrides);
  });
};

TestObject.HOST = 'app.staging.testobject.org';

/**
 * Overrides the WD (admc/wd) prototype to force it to use TestObject
 */
TestObject.overrideWD = function (wd) {
  const originalInit = wd.prototype.init;
  wd.prototype.init = async function (caps, ...args) {
    const extendedCaps = await TestObject.getTestObjectCaps(caps);
    return await originalInit(extendedCaps, args);
  };

  const originalPromiseChainRemote = wd.prototype.promiseChainRemote;
  wd.prototype.promiseChainRemote = async function (host, port, ...args) {
    return await originalPromiseChainRemote(TestObject.HOST, port, ...args);
  };
  
  return {originalInit, originalPromiseChainRemote};
};

/**
 * Undo the overrides done in WD
 */
TestObject.restoreWD = function (wd, {originalInit, originalPromiseChainRemote}) {
  wd.prototype.init = originalInit;
  wd.prototype.promiseChainRemote = originalPromiseChainRemote;
};

export default TestObject;