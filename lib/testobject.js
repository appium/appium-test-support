// import { uploadZip, deleteZip } from './s3';
// import yargs from 'yargs';

const TestObject = {};

TestObject.getTestObjectCaps = async function (caps = {}) {
  if (!process.env.TESTOBJECT_API_KEY) {
    throw new Error('Must provide TESTOBJECT_API_KEY in environment variables');
  }

  // Upload the app to TestObject
  let testobject_app_id;
  try {
    testobject_app_id = await TestObject.uploadTestObjectApp();
  } catch (e) {
    throw new Error(`Could not upload ${caps.app} to TestObject: ${e.message}`);
  }
  return  Object.assign(caps, {
    testobject_app_id,
    testobject_api_key: process.env.TESTOBJECT_API_KEY,
    testobject_cache_device: true,
  });
};

TestObject.uploadTestObjectApp = async function () {
  throw new Error(`Not implemented`);
};

TestObject.useTestObjectForMochaTests = async function (appiumDir, app) {
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