import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import wd from 'wd';
import { usingTestObject, overrideWD, uploadTestObjectApp, HOST as TESTOBJECT_HOST } from '../../lib/testobject';
import sinon from 'sinon';

chai.should();
chai.use(chaiAsPromised);

describe('TestObject', function () {
  describe.only('#uploadTestObjectApp', function () {
    it('should upload fake app file to testObject', async function () {
      await uploadTestObjectApp(path.resolve('test', 'fixtures', 'SampleAndroidApp.apk')).should.eventually.be.resolved;
    });
  });

  describe('#usingTestObject', function () {
    const fakeDriverPath = path.resolve(process.env.PWD, 'node_modules', 'appium-fake-driver');
    usingTestObject.call(this, wd, fakeDriverPath);
    
    it('should start wd session on TestObject server when using "usingTestObject"', async function () {
      const driver = await wd.promiseChainRemote();
      await driver.init({
        app: path.resolve('test', 'fixtures', 'fakeApp.app'),
      });
      return driver;
    });
  });
});