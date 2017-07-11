import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import wd from 'wd';
import request from 'request-promise';
import { uploadTestObjectApp, disableTestObject, enableTestObject } from '../../lib/testobject';

chai.should();
chai.use(chaiAsPromised);

describe('TestObject', function () {
  this.timeout(20 * 60 * 1000);
  describe('#uploadTestObjectApp', function () {
    it('should upload fake app file to testObject', async function () {
      await uploadTestObjectApp(path.resolve('test', 'fixtures', 'ContactManager.apk')).should.eventually.be.resolved;
    });
  });

  describe('.enableTestObject, .disableTestObject', function () {
    it('should enable testObject tests and then be able to disable them afterwards', async function () {
      const wdObject = await enableTestObject(wd, path.resolve(process.env.PWD, 'node_modules', 'appium'));

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