// transpile:mocha
/* eslint-disable promise/prefer-await-to-callbacks */

import { uploadZip, deleteZip } from '../lib/s3';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import AWS from 'aws-sdk';
import { zip, fs } from 'appium-support';
chai.should();
chai.use(chaiAsPromised);

describe('s3', () => {
  let s3Proto = Object.getPrototypeOf(new AWS.S3());

  describe('uploadZip', () => {
    let fileExistsStub, readFileStub;
    beforeEach(() => {
      fileExistsStub = sinon.stub(fs, 'exists', () => true);
      readFileStub = sinon.stub(fs, 'readFile', () => "dummy");
    });
    afterEach(() => {
      fileExistsStub.restore();
      readFileStub.restore();
    });
    it('should reject if AWS_S3_BUCKET not defined in env', async () => {
      const backupBucket = process.env.AWS_S3_BUCKET;
      delete process.env.AWS_S3_BUCKET;
      await uploadZip().should.eventually.be.rejectedWith(/AWS_S3_BUCKET/);
      process.env.AWS_S3_BUCKET = backupBucket;
    });
    it('should reject if file does not exist', async () => {
      fileExistsStub.restore();
      fileExistsStub = sinon.stub(fs, 'exists', () => false);
      await uploadZip('/fake/file/path.zip').should.eventually.be.rejectedWith(/Could not find/);
    });
    it('should reject if s3.upload fails', async () => {
      const uploaderStub = sinon.stub(s3Proto, 'upload', (obj, cb) => { cb(new Error('does not matter')); });
      await uploadZip('/fake/file/path.zip').should.eventually.be.rejectedWith(/Could not upload/);
      uploaderStub.restore();
    });
    it('should pass if s3.upload does not fail', async () => {
      const uploaderStub = sinon.stub(s3Proto, 'upload', (obj, cb) => { cb(null, 'Success'); });
      await uploadZip().should.eventually.equal('Success');
      uploaderStub.restore();
    });
  });

  describe('deleteZip', () => {
    it('should reject if AWS_S3_BUCKET not defined in env', async () => {
      const backupBucket = process.env.AWS_S3_BUCKET;
      delete process.env.AWS_S3_BUCKET;
      await deleteZip().should.eventually.be.rejectedWith(/AWS_S3_BUCKET/);
      process.env.AWS_S3_BUCKET = backupBucket;
    });
    it('should reject if s3.deleteObject throws error', async () => {
      const deleteObjectStub = sinon.stub(s3Proto, 'deleteObject', (obj, cb) => { cb(new Error('does not matter')); });
      await deleteZip().should.eventually.be.rejectedWith(/Could not delete/);
      deleteObjectStub.restore();
    });
    it('should resolve if s3.deleteObject does not fail', async () => {
      const deleteObjectStub = sinon.stub(s3Proto, 'deleteObject', (obj, cb) => { cb(null, 'Success'); });
      await deleteZip().should.eventually.equal('Success');
      deleteObjectStub.restore();
    });
  });
});
