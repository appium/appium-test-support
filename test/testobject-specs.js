// transpile:mocha

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stubEnv } from '../..';
import sinon from 'sinon';
import TestObject from '../lib/testobject';
const { /*useTestObjectForMochaTests,*/ getTestObjectCaps } = TestObject;

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
    it('should be rejected if TESTOBJECT_API_KEY not set', async function () {
      process.env.TESTOBJECT_API_KEY = null;
      await getTestObjectCaps().should.eventually.be.rejectedWith(/TESTOBJECT_API_KEY/);
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
  });

});