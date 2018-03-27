// transpile:mocha
/* eslint-disable promise/prefer-await-to-callbacks */

import S3 from '../lib/s3';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import AWS from 'aws-sdk';
import { fs } from 'appium-support';

const {uploadZip} = S3;

chai.should();
chai.use(chaiAsPromised);

describe('s3', function () {
  let s3Proto = Object.getPrototypeOf(new AWS.S3());

  describe('uploadZip', function () {
    let fileExistsStub, readFileStub, uploaderStub, s3FileExistsStub;
    beforeEach(function () {
      fileExistsStub = sinon.stub(fs, 'exists');
      readFileStub = sinon.stub(fs, 'readFile');
      s3FileExistsStub = sinon.stub(S3, 'fileExists');
      readFileStub.returns('dummy');
      fileExistsStub.returns(true);
    });
    afterEach(function () {
      fileExistsStub.restore();
      readFileStub.restore();
      s3FileExistsStub.restore();
    });
    it('should reject if AWS_S3_BUCKET not defined in env', async function () {
      const backupBucket = process.env.AWS_S3_BUCKET;
      delete process.env.AWS_S3_BUCKET;
      await uploadZip().should.eventually.be.rejectedWith(/AWS_S3_BUCKET/);
      process.env.AWS_S3_BUCKET = backupBucket;
    });
    it('should reject if file does not exist', async function () {
      fileExistsStub.restore();
      fileExistsStub.returns(false);
      const fakeEventObject = {
        on: () => {},
      };
      uploaderStub = sinon.stub(s3Proto, 'upload', ((obj, cb) => {
        cb('Could not find');
        return fakeEventObject;
      }));
      await uploadZip('/fake/file/path.zip').should.eventually.be.rejectedWith(/Could not find/);
      uploaderStub.restore();
    });
    it('should reject if s3.upload fails', async function () {
      const fakeEventObject = {
        on: () => {},
      };
      uploaderStub = sinon.stub(s3Proto, 'upload', ((obj, cb) => {
        cb(new Error('some random S3 error'));
        return fakeEventObject;
      }));
      await uploadZip('/fake/file/path.zip').should.eventually.be.rejectedWith(/Could not upload/);
      uploaderStub.restore();
    });
    it('should pass if s3.upload does not fail', async function () {
      const fakeEventObject = {
        on: () => {},
      };
      uploaderStub = sinon.stub(s3Proto, 'upload', ((obj, cb) => {
        cb(null, 'Success');
        return fakeEventObject;
      }));
      s3FileExistsStub.returns(false);
      await uploadZip('/fake/file/path.zip').should.eventually.be.resolved;
      uploaderStub.restore();
    });
    it('should not reupload if it is cached', async function () {
      const fakeEventObject = {
        on: () => {},
      };

      // Shouldn't matter if s3.upload fails
      uploaderStub = sinon.stub(s3Proto, 'upload', ((obj, cb) => {
        cb(new Error('some random S3 error'));
        return fakeEventObject;
      }));
      s3FileExistsStub.returns(true);
      await uploadZip('/fake/file/path.zip').should.eventually.be.resolved;
    });
  });
});
