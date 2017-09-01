// transpile:mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import { stubEnv } from '../..';
import sinon from 'sinon';
import TestObject from '../lib/testobject';
import S3 from '../lib/s3';
import * as teenProcess from 'teen_process';
const { getTestObjectCaps, uploadTestObjectApp, overrideWD } = TestObject;
import { fs } from 'appium-support';

chai.should();
chai.use(chaiAsPromised);

describe('testobject-utils.js', function () {
  stubEnv();
  const appId = 1234;
  let uploadStub;
  beforeEach(function () {
    uploadStub = sinon.stub(TestObject, 'uploadTestObjectApp', () => appId);
  });

  afterEach(function () {
    uploadStub.restore();
  });

  describe('#getTestObjectCaps', function () {
    beforeEach(function () {
      delete process.env.TESTOBJECT_DEVICE;
    });
    it('should be rejected if call to uploadTestObjectApp is rejected', async function () {
      uploadStub.restore();
      uploadStub = sinon.stub(TestObject, 'uploadTestObjectApp', () => { throw new Error('Fake error'); });
      await getTestObjectCaps().should.eventually.be.rejectedWith(/Could not upload/);
    });
    it('should pass a cap with the TESTOBJECT_API_KEY and testobject_app_id in it', async function () {
      process.env.TESTOBJECT_API_KEY = 'foobar';
      const caps = await getTestObjectCaps();
      caps.testobject_api_key.should.equal(process.env.TESTOBJECT_API_KEY);
      caps.testobject_app_id.should.equal(appId);
    });
    it('should extend caps that were passed in', async function () {
      process.env.TESTOBJECT_API_KEY = 'c';
      const caps = await getTestObjectCaps({
        a: 'a',
        b: 'b',
      });
      caps.a.should.equal('a');
      caps.b.should.equal('b');
      caps.testobject_api_key.should.equal('c');
    });
    it('should set testobject_device to default device if no env variable is set', async function () {
      (await getTestObjectCaps()).testobject_device.should.equal(TestObject.DEFAULT_DEVICE);
    });
    it('should set testobject_device to default IOS device if no env variable is set and platformName is IOS', async function () {
      (await getTestObjectCaps({
        platformName: 'ios',
      })).testobject_device.should.equal(TestObject.DEFAULT_IOS_DEVICE);
    });
    it('should set testobject_device to process.env.TESTOBJECT_DEVICE', async function () {
      process.env.TESTOBJECT_DEVICE = 'fake_device';
      (await getTestObjectCaps()).testobject_device.should.equal('fake_device');
    });
  });

  describe('#uploadTestObjectApp', function () {
    let execStub, fsStatStub;
    beforeEach(function () {
      process.env.TESTOBJECT_USERNAME = 'foobar';
      process.env.TESTOBJECT_API_KEY = 1234;
      execStub = sinon.stub(teenProcess, 'exec', () => ({stdout: 1}));
      fsStatStub = sinon.stub(fs, 'stat', () => ({
        mtime: +(new Date()) - 2 * 24 * 60 * 60 * 1000, // Pretend app was last modified 2 days ago
      }));
    });
    afterEach(function () {
      execStub.restore();
      fsStatStub.restore();
    });
    it('should be upload if TESTOBJECT_USERNAME and TESTOBJECT_API_KEY is set', async function () {
      await uploadTestObjectApp().should.eventually.equal(1);
    });
    it('should be rejected if TESTOBJECT_USERNAME is not defined', async function () {
      process.env.TESTOBJECT_USERNAME = null;
      await uploadTestObjectApp().should.eventually.be.rejectedWith(/TESTOBJECT_USERNAME/);
    });
    it('should be rejected if TESTOBJECT_API_KEY not set', async function () {
      process.env.TESTOBJECT_API_KEY = null;
      await uploadTestObjectApp().should.eventually.be.rejectedWith(/TESTOBJECT_API_KEY/);
    });
    it('should call cURL with -u and --data-binary args', async function () {
      execStub.restore(); // wrapping differently than the rest, so restore and re-wrap
      execStub = sinon.stub(teenProcess, 'exec', (command, args) => {
        command.should.equal('curl');
        args[1].should.equal('foobar:1234');
        args[args.length - 1].should.equal('@fakeapp.app');
        return {stdout: ''};
      });
      await uploadTestObjectApp('fakeapp.app').should.eventually.be.resolved;
    });
    it('should re-use appId if app was already uploaded earlier', async function () {
      TestObject._appIdCache['fakeapp.app'] = {
        id: 2,
        uploaded: +(new Date()) - 24 * 60 * 60 * 1000,
      };
      await uploadTestObjectApp('fakeapp.app').should.eventually.equal(2);
      delete TestObject._appIdCache['fakeapp.app'];
    });
    it('should save uploaded app to cache', async function () {
      await uploadTestObjectApp('fakeapp.app');
      const cache = TestObject._appIdCache['fakeapp.app'];

      // Test that the cache recorded it being uploaded within the last 10 seconds
      cache.uploaded.should.be.below(+(new Date()) + 1);
      cache.uploaded.should.be.above(+(new Date()) - 10000);
      cache.id.should.equal(1);
    });
    it('should re-upload app if app was modified after it was uploaded', async function () {
      TestObject._appIdCache['fakeapp.app'] = {
        id: 2,
        uploaded: +(new Date()) - 2 * 24 * 60 * 60 * 1000 - 1, // 2 days ago minus a millisecond
      };
      await uploadTestObjectApp('fakeapp.app').should.eventually.equal(1);
      TestObject._appIdCache['fakeapp.app'].id.should.equal(1);
    });
  });

  describe('#overrideWD', function () {
    let initSpy, promiseChainRemoteSpy, MockWD;

    beforeEach(function () {
      initSpy = sinon.spy();
      promiseChainRemoteSpy = sinon.spy();

      MockWD = function MockWD () {

      };

      MockWD.promiseChainRemote = async function promiseChainRemote (...args) {
        promiseChainRemoteSpy(...args);
        const driver = {
          init (caps) {
            initSpy(caps);
          },
        };
        return driver;
      };

    });

    it('should override wd.promiseChainRemote and driver.init', async function () {
      // Call without overriding
      let driver = await MockWD.promiseChainRemote('HOST', 'PORT');
      promiseChainRemoteSpy.firstCall.args.should.deep.equal(['HOST', 'PORT']);
      await driver.init({hello: 'world'});
      initSpy.firstCall.args.should.deep.equal([{hello: 'world'}]);

      // Override and then call again
      overrideWD(MockWD, '/path/to/appium/zip');
      driver = await MockWD.promiseChainRemote({host: 'localhost', port: 123456, https: false, other: 'other'});

      // Test that promiseChainRemote was correctly overridden
      let params = promiseChainRemoteSpy.secondCall.args[0];
      params.host.should.equal(TestObject.HOST);
      params.port.should.equal(TestObject.PORT);
      params.https.should.equal(true);
      params.other.should.equal('other');

      // Test that init was correctly overridden
      await driver.init({hello: 'world'});
      params = initSpy.secondCall.args[0];
      params.testobject_remote_appium_url.should.equal('/path/to/appium/zip');
      params.hello.should.equal('world');
    });
  });

  describe('#enableTestObject', function () {
    let uploadZipStub, overrideWDStub;

    beforeEach(async function () {
      uploadZipStub = sinon.stub(S3, 'uploadZip');
      overrideWDStub = sinon.stub(TestObject, 'overrideWD');
    });

    afterEach(function () {
      uploadZipStub.restore();
      overrideWDStub.restore();
    });

    it('should be rejected if it fails to upload appiumDir zip', async function () {
      uploadZipStub.throws('S3 Upload Error');
      await TestObject.enableTestObject(null, '/does/not/matter').should.eventually.be.rejectedWith(/S3 Upload Error/);
    });

    it('should call uploadZip and then return the result of overrideWD', async function () {
      let fakeWD = {fakeWD: 'fakeWD'};
      uploadZipStub.reset();
      uploadZipStub.returns({Location: 'HelloWorldLand', Key: 'key'});
      overrideWDStub.throws('Incorrect parameters');
      overrideWDStub.withArgs(fakeWD, 'HelloWorldLand').returns('hello world');
      const {wdOverride, appiumS3Object, wd} = await TestObject.enableTestObject(fakeWD, '/does/not/matter');
      appiumS3Object.should.deep.equal({
        Location: 'HelloWorldLand',
        Key: 'key',
      });
      wd.should.deep.equal({fakeWD: 'fakeWD'});
      wdOverride.should.equal('hello world');
    });
  });
  describe('#disableTestObject', function () {
    let restoreWDStub, deleteZipStub;
    beforeEach(async function () {
      restoreWDStub = sinon.stub(TestObject, 'restoreWD');
      deleteZipStub = sinon.stub(S3, 'deleteZip');
    });
    it('should call restoreWD and deleteZip', function () {
      restoreWDStub.throws('invalid args');
      deleteZipStub.throws('invalid args');
      const wdObj = {
        wd: 'wd',
        wdOverride: 'wdOverride',
        appiumS3Object: {Key: 'appiumS3ObjectKey'},
      };
      restoreWDStub.withArgs('wd', 'wdOverride').returns(undefined);
      deleteZipStub.withArgs('appiumS3ObjectKey').returns(undefined);
      TestObject.disableTestObject(wdObj).should.eventually.be.resolved;
    });
  });
});
