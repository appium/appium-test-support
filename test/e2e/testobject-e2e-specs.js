import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import wd from 'wd';
import request from 'request-promise';
import { fs } from 'appium-support';
import { uploadTestObjectApp, disableTestObject, enableTestObject, fetchAppium } from '../../lib/testobject';

chai.should();
chai.use(chaiAsPromised);

describe('TestObject', function () {
  describe('#fetchAppium', function () {
    it('fetches appium zip', async function () {
      const appiumZip = await fetchAppium('appium-uiautomator2-driver', 'git+ssh://git@github.com/appium/appium-uiautomator2-driver.git');
      await fs.exists(appiumZip).should.eventually.be.true;
    });
  });

  describe('#uploadTestObjectApp', function () {
    it('should upload fake app file to testObject', async function () {
      await uploadTestObjectApp(path.resolve('test', 'fixtures', 'ContactManager.apk')).should.eventually.be.resolved;
    });
  });

  describe('.enableTestObject, .disableTestObject', function () {
    it('should enable testObject tests and then be able to disable them afterwards', async function () {
      const wdObject = await enableTestObject(wd, 'appium-uiautomator2-driver', 'git+ssh://git@github.com/appium/appium-uiautomator2-driver.git');

      // Test that the zip was uploaded
      const location = wdObject.appiumS3Object.Location;
      await request(location).should.eventually.be.resolved;

      // Test that we can do TestObject tests
      const driver = await wd.promiseChainRemote();
      await driver.init({
        app: path.resolve('test', 'fixtures', 'ContactManager.apk'),
      });
      const source = await driver.source();
      source.should.contain('android.widget.LinearLayout');
      await driver.quit();

      // Check that after we clean up, the zip file is gone
      await disableTestObject(wdObject);
      await request(location).should.eventually.be.rejectedWith(/403/);
    });
  });
});