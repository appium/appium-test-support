import AWS from 'aws-sdk';
import B from 'bluebird';
import { fs } from 'appium-support';
import { v4 as uuid } from 'uuid';
import logger from '../lib/logger';

const Bucket = process.env.AWS_S3_BUCKET;

let s3 = new AWS.S3({
  params: {
    Bucket,
  },
});

const S3 = {};

/**
 * Zips a local directory and uploads it to S3
 * @param {*} localDir
 */
S3.uploadZip = async function (pathToZip) {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('To use S3, you must specify AWS_S3_BUCKET in environment variables');
  }
  if (!fs.exists(pathToZip)) {
    throw new Error(`Could not find directory ${pathToZip}`);
  }

  // Call s3.upload and return it as a promise
  // (NOTE: B.promisify doesn't work for s3.upload, it causes s3/managed_upload.js to throw an error `self.service.constructor.__super__ is not a constructor`)
  logger.debug(`Uploading ${pathToZip} to S3 ${Bucket}`);
  return await new B(async (resolve, reject) => {
    const uploader = s3.upload({
      Bucket,
      Key: `${uuid()}.zip`, // Name it with a GUID to avoid conflicts
      ACL: 'public-read',
      Expiration: 1, // Expires after one day
      Body: await fs.readFile(pathToZip),
    }, (err, res) => {
      if (err) {
        reject(new Error(`Could not upload ${pathToZip} to S3. Check that you have set the S3 environment variables correctly: ${err}`));
      } else {
        resolve(res);
        uploader.on('httpUploadProgress', (progress) => logger.debug(`Uploading ${pathToZip} progress ${Math.round(progress.loaded / progress.total * 100)}%`));
      }
    });
  });
};

/**
 * Deletes a file at given URL
 */
S3.deleteZip = async function (key) {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('To use S3, you must specify AWS_S3_BUCKET in environment variables');
  }
  return await new B((resolve, reject) => {
    s3.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }, (err, res) => err ? reject(new Error(`Could not delete zip ${key}: ${err}`)) : resolve(res));
  });
};

export default S3;
