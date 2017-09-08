import AWS from 'aws-sdk';
import B from 'bluebird';
import { fs } from 'appium-support';
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
S3.uploadZip = async function (pathToZip, zipfileName) {
  if (!process.env.AWS_S3_BUCKET) {
    throw new Error('To use S3, you must specify AWS_S3_BUCKET in environment variables');
  }
  if (!fs.exists(pathToZip)) {
    throw new Error(`Could not find directory ${pathToZip}`);
  }

  // If this file already exists, don't create a new one
  if (await S3.fileExists(zipfileName)) {
    return S3.getS3Location(zipfileName);
  }

  // Call s3.upload and return it as a promise
  // (NOTE: B.promisify doesn't work for s3.upload, it causes s3/managed_upload.js to throw an error `self.service.constructor.__super__ is not a constructor`)
  logger.debug(`Uploading ${pathToZip} to S3 ${Bucket}`);
  let body = await fs.readFile(pathToZip);
  return await new B((resolve, reject) => {
    const uploader = s3.upload({
      Bucket,
      Key: zipfileName, // Name it with a GUID to avoid conflicts
      ACL: 'public-read',
      Expiration: 1, // Expires after one day
      Body: body,
    }, (err, res) => {
      if (err) {
        reject(new Error(`Could not upload ${pathToZip} to S3. Check that you have set the S3 environment variables correctly: ${err}`));
      } else {
        logger.debug(`File uploaded as ${res.Location}`);
        resolve(res.Location);
      }
    });
    uploader.on('httpUploadProgress', (progress) => logger.debug(`Uploading ${pathToZip} progress ${Math.round(progress.loaded / progress.total * 100)}%`));
  });
};

S3.fileExists = async function (fileName) {
  logger.debug(`Looking for cached copy of ${fileName}`);
  return await new B((resolve) => {
    s3.headObject({
      Bucket,
      Key: fileName,
    }, (err) => {
      if (err) {
        logger.debug(`Copy of ${fileName} not found.`);
        resolve(false);
      } else {
        logger.debug(`Found a copy of ${fileName}`);
        resolve(true);
      }
    });
  });
};

S3.getS3Location = function (fileName) {
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(fileName)}`;
};

export default S3;
