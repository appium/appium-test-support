// import { uploadZip, deleteZip } from './s3';
// import yargs from 'yargs';
import { exec } from 'teen_process';
import { fs } from 'appium-support';

const TestObject = {};

TestObject.getTestObjectCaps = async function (caps = {}) {
  // Upload the app to TestObject
  let testobject_app_id;
  try {
    testobject_app_id = await TestObject.uploadTestObjectApp(caps.app);
  } catch (e) {
    throw new Error(`Could not upload ${caps.app} to TestObject: ${e.message}`);
  }
  return  Object.assign(caps, {
    testobject_app_id,
    testobject_api_key: process.env.TESTOBJECT_API_KEY,
    testobject_cache_device: true,
  });
};

// When an app is uploaded and test_id returned, save the test_id for later use
TestObject._appIdCache = {};

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

TestObject.usingTestObject = async function (appiumDir, app) {
  /*let res;
  yargs.argv.host = 'app.staging.testobject.org';
  before(async function () { // jshint ignore:line
    this.timeout(300000); // Set a long timeout because we're uploading a large file to s3
    console.log('process.env.TESTOBJECT===true: Running tests on TestObject');
    console.log(`Uploading ${process.env.PWD} to S3`);
    res = await uploadZip(process.env.PWD);
    console.log(`Done uploading ${process.env.PWD} to S3`);
  });

  after(async function () { // jshint ignore:line
    console.log(`Deleting ${process.env.PWD} from S3`);
    await deleteZip(res.Key);
    console.log(`Deleted ${process.env.PWD} from S3`);
  });*/
  return { appiumDir, app };
};

export default TestObject;