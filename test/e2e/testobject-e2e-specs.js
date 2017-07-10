import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import wd from 'wd';
import { usingTestObject, overrideWD, uploadTestObjectApp, HOST as TESTOBJECT_HOST } from '../../lib/testobject';
import sinon from 'sinon';

chai.should();
chai.use(chaiAsPromised);

describe('TestObject', function () {
  describe('#uploadTestObjectApp', function () {
    it('should upload fake app file to testObject', async function () {
      await uploadTestObjectApp(path.resolve('test', 'fixtures', 'ContactManager.apk')).should.eventually.be.resolved;
    });
  });

  describe.only('#usingTestObject', function () {
    const fakeDriverPath = path.resolve(process.env.PWD, 'node_modules', 'appium');
    usingTestObject.call(this, wd, fakeDriverPath);
    
    it('should start wd session on TestObject server when using "usingTestObject" and be able to get the source of the test app', async function () {
      const driver = await wd.promiseChainRemote();
      await driver.init({
        app: path.resolve('test', 'fixtures', 'ContactManager.apk'),
      });
      const source = await driver.source();
      source.should.contain('android.widget.LinearLayout');
      return driver;
    });
  });
});