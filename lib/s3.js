import AWS from 'aws-sdk';
import B from 'bluebird';
import { zip, fs } from 'appium-support';
import { v4 as uuid } from 'uuid';

const Bucket = process.env.AWS_S3_BUCKET;

let s3 = new AWS.S3({
  params: {
    Bucket,
  },
});



/**
 * Zips a local directory and uploads it to S3
 * @param {*} localDir 
 */
async function uploadZip (localDir) {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('To use S3, you must specify AWS_S3_BUCKET in environment variables');
  }
  if (!fs.exists(localDir)) {
    throw new Error(`Could not find directory ${localDir}`);
  }

  // Attempt to zip the directory
  let base64Zip;
  try {
    base64Zip = await zip.toInMemoryZip(localDir);
  } catch (err) {
    throw new Error(`Could not zip directory ${localDir}: ${err}`);
  }

  // Call s3.upload and return it as a promise
  // (NOTE: B.promisify doesn't work for s3.upload, it causes s3/managed_upload.js to throw an error `self.service.constructor.__super__ is not a constructor`)
  return await new B((resolve, reject) => {
    s3.upload({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `${uuid()}.zip`, // Give it a random name
      ACL: 'public-read',
      Expiration: 1, // Expires after one day
      Body: base64Zip,
    }, (err, res) => err ? reject(new Error(`Could not upload ${localDir} to S3. Check that you have set the S3 environment variables correctly: ${err}`)) : resolve(res));
  });
}

/**
 * Deletes a file at given URL
 */
async function deleteZip (key) {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('To use S3, you must specify AWS_S3_BUCKET in environment variables');
  }
  return await new B((resolve, reject) => {
    s3.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }, (err, res) => err ? reject(new Error(`Could not delete zip ${key}: ${err}`)) : resolve(res));
  });
}

export {uploadZip, deleteZip};