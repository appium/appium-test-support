import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import request from 'request-promise';
import path from 'path';
import { tempDir, fs } from 'appium-support';
import { uploadZip, deleteZip } from '../../lib/s3';
import B from 'bluebird';

const {openDir} = tempDir;
const {writeFile, mkdir} = fs;

chai.should();
chai.use(chaiAsPromised);

describe('S3', () => {
  let tempDir, testDir;

  before(async () => {
    // Create a temporary directory with one file and upload it to S3
    tempDir = await openDir('temp-e2e-test-dir');
    testDir = path.resolve(tempDir, 'test-dir');
    await mkdir(testDir);
    const fileContents = 'Temporary file contents';
    await writeFile(path.resolve(testDir, 'temp-file.txt'), fileContents);
  });

  it('should zip directories and publish them to S3 and then unpublish them', async function () {
    // Don't run the tests if AWS credentials are not set
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      this.skip();
    }
    const res = await uploadZip(testDir);

    // Download the zipped directory, unzip it, and compare it's contents to the original temporary directory
    await request(res.Location).should.eventually.be.resolved;

    // Delete the directory from S3 and verify that it was successfully deleted
    await deleteZip(res.key).should.eventually.be.resolved;
    await B.delay(1000); // Give it a second for the URL to become inaccessible
    await request(res.Location).should.eventually.be.rejectedWith(/403/);
  });
});