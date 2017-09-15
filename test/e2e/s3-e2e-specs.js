import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import request from 'request-promise';
import path from 'path';
import { tempDir, fs } from 'appium-support';
import { uploadZip } from '../../lib/s3';
import sinon from 'sinon';
import AWS from 'aws-sdk';
import { v4 as uuid } from 'uuid';

const {openDir} = tempDir;
const {writeFile, mkdir} = fs;

chai.should();
chai.use(chaiAsPromised);

describe('S3', () => {
  let tempDir, testDir, zipPath, s3UploadSpy, s3Proto;

  before(async () => {
    // Create a temporary directory with one file and upload it to S3
    tempDir = await openDir('temp-e2e-test-dir');
    testDir = path.resolve(tempDir, 'test-dir');
    await mkdir(testDir);
    const fileContents = 'Temporary file contents';
    zipPath = path.resolve(testDir, 'temp-file.zip');
    await writeFile(zipPath, fileContents);
    s3Proto = Object.getPrototypeOf(new AWS.S3());
    s3UploadSpy = sinon.spy(s3Proto, 'upload');
  });

  after(async () => {
    s3UploadSpy.restore();
  });

  it('should zip directories and publish them to S3 and then unpublish them', async function () {
    // Don't run the tests if AWS credentials are not set
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      this.skip();
    }

    const uniqueFileName = `git+https://github.com/fake/library${uuid()}`;

    s3Proto.upload.notCalled.should.be.true;
    const location = await uploadZip(zipPath, uniqueFileName);

    // Check that we can download it
    await request(location).should.eventually.be.resolved;
    s3Proto.upload.calledOnce.should.be.true;

    // Now upload it again, this time it shouldn't call s3.upload again
    const nextLocation = await uploadZip(zipPath, uniqueFileName);
    s3Proto.upload.calledOnce.should.be.true;
    s3Proto.upload.calledTwice.should.be.false;

    const firstLocationContents = await request(location);
    await request(nextLocation).should.eventually.equal(firstLocationContents);
  });
});