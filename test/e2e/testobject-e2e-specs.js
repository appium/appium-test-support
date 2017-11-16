import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import wd from 'wd';
import request from 'request-promise';
import { fs } from 'appium-support';
import AWS from 'aws-sdk';
import sinon from 'sinon';
import { uploadTestObjectApp, enableTestObject, disableTestObject, fetchAppium } from '../../lib/testobject';

chai.should();
chai.use(chaiAsPromised);

describe('TestObject', function () {
  describe('#fetchAppium @skip-ci', function () {
    it('fetches appium zip', async function () {
      const appiumZip = await fetchAppium(
        'appium-uiautomator2-driver',
        'git+https://git@github.com/appium/appium-uiautomator2-driver.git',
        'master',
      );
      await fs.exists(appiumZip).should.eventually.be.true;
    });
  });

  describe('#uploadTestObjectApp', function () {
    it('should upload fake app file to testObject', async function () {
      await uploadTestObjectApp(path.resolve('test', 'fixtures', 'ContactManager.apk')).should.eventually.be.resolved;
    });
  });

  describe('.enableTestObject, .disableTestObject', function () {
    it.skip('should enable testObject tests and then be able to disable them afterwards', async function () {
      const s3Proto = Object.getPrototypeOf(new AWS.S3());
      const s3UploadSpy = sinon.spy(s3Proto, 'upload');
      s3Proto.upload.notCalled.should.be.true;
      const wdObject = await enableTestObject(
        wd,
        'appium-uiautomator2-driver',
        'git+https://git@github.com/appium/appium-uiautomator2-driver.git',
        'master',
      );
      s3Proto.upload.callCount.should.be.below(2);

      // Test that the zip was uploaded
      const location = wdObject.s3Location;
      await request(location).should.eventually.be.resolved;

      // Test that we can do TestObject tests
      const driver = await wd.promiseChainRemote();
      await driver.init({
        app: path.resolve('test', 'fixtures', 'ContactManager.apk'),
      });
      const source = await driver.source();
      source.should.contain('android.widget.LinearLayout');
      await driver.quit();

      // Disable test object
      await disableTestObject(wdObject);

      // Enable it again
      await enableTestObject(wd, 'appium-uiautomator2-driver', 'git+ssh://git@github.com/appium/appium-uiautomator2-driver.git');
      s3Proto.upload.calledTwice.should.be.false;
      s3UploadSpy.restore();
    });
  });
});