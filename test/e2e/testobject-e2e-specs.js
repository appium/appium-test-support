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
      await uploadTestObjectApp(path.resolve('test', 'fixtures', 'fakeApp.app')).should.eventually.be.resolved;
    });
  });

  describe(() => {});

  describe('#overrideWD', function () {
    it('should override the admc/wd promiseChainRemote', async function () {
      const promiseChainRemoteSpy = sinon.spy(wd, 'promiseChainRemote');
      overrideWD(wd);
      const driver = new wd.promiseChainRemote();
      promiseChainRemoteSpy.calledOnce.should.be.true;
      promiseChainRemoteSpy.firstCall.args[0].should.equal(TESTOBJECT_HOST);
      promiseChainRemoteSpy.restore();
      return driver;
    });
  });

  describe.only('#usingTestObject', function () {
    usingTestObject.call(this, wd, path.resolve(process.env.PWD, 'node_modules', 'appium-fake-driver'));
    it('should start wd session on TestObject server when using "usingTestObject"', async function () {
      const driver = await wd.promiseChainRemote();
      await driver.init({
        app: path.resolve('test', 'fixtures', 'fakeApp.app'),
      });
      return driver;
    });
  });
});