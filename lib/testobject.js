import path from 'path';
import S3 from './s3';
import { exec, SubProcess } from 'teen_process';
import { fs, tempDir } from 'appium-support';
import { createWriteStream } from 'fs';
import B from 'bluebird';
import logger from '../lib/logger';
import _ from 'lodash';
import archiver from 'archiver';

const TestObject = {};

/**
 * Takes desired capabilities and extends it with testobject capabilities
 */
TestObject.getTestObjectCaps = async function (caps = {}) {
  // Upload the app to TestObject
  let testobjectAppId;
  if (caps.app) {
    logger.debug(`Uploading TestObject app: ${caps.app}`);
    try {
      testobjectAppId = await TestObject.uploadTestObjectApp(caps.app);
    } catch (e) {
      throw new Error(`Could not upload '${caps.app}' to TestObject: ${e.message}`);
    }
    logger.debug(`Done uploading TestObject app: ${caps.app}. AppID is ${testobjectAppId}`);
  }

  // Determine the TestObject_device
  let testobjectDevice;
  if (process.env.TESTOBJECT_DEVICE) {
    testobjectDevice = process.env.TESTOBJECT_DEVICE;
  }

  // Don't pass the deviceName through, let T.O. handle that dynamically
  delete caps.deviceName;

  // Extend the provided caps with special testobject caps
  // (see https://app.staging.testobject.org/#/danielgraham/contact-manager/appium/basic/instructions)
  return  Object.assign({
    testobject_app_id: testobjectAppId,
    testobject_device: testobjectDevice,
    platformVersion: process.env.TESTOBJECT_PLATFORM_VERSION,
    testobject_api_key: caps.testobject_api_key || process.env.TESTOBJECT_API_KEY,
  }, caps);
};

TestObject._appIdCache = {};


/**
 * Uploads your app (.app, .apk, .ipa etc...) to TestObject server
 */
TestObject.uploadTestObjectApp = async function (app) {
  if (!process.env.TESTOBJECT_API_KEY) {
    throw new Error('Must provide TESTOBJECT_API_KEY in environment variables');
  }
  if (!process.env.TESTOBJECT_USERNAME) {
    throw new Error('Must define TESTOBJECT_USERNAME in environment variables');
  }

  // If this app was already uploaded and hasn't changed since last upload, re-use the app id
  const cache = TestObject._appIdCache[app];
  if (cache) {
    const {mtime} = await fs.stat(app);
    const modifiedTime = +(new Date(mtime));
    if (modifiedTime < cache.uploaded) {
      return cache.id;
    }
  }

  // Upload the app
  // (see https://app.staging.testobject.org/#/danielgraham/contact-manager/appium/basic/instructions)
  try {
    const {stdout:appId, stderr} = (await exec('curl', [
      '-u',  `${process.env.TESTOBJECT_USERNAME}:${process.env.TESTOBJECT_API_KEY}`,
      '-X', 'POST', 'https://app.staging.testobject.org:443/api/storage/upload',
      '-H', 'Content-Type: application/octet-stream',
      '--data-binary', `@${app}`,
    ]));

    if (!appId && stderr) {
      throw new Error(stderr);
    }

    TestObject._appIdCache[app] = {
      id: appId,
      uploaded: +(new Date()),
    };
    return appId;
  } catch (e) {
    logger.error(`Could not upload '${app}' to TestObject. Log into https://app.staging.testobject.org/ and verify that ${app} has been uploaded manually.
      The API call to /api/storage/upload re-uploads apps. It doesn't upload them the first time: (${e})`);
    throw e;
  }
};

TestObject.MOCHA_TESTOBJECT_TIMEOUT = 30 * 60 * 1000; // Half an hour limit

TestObject.HOST = 'appium.staging.testobject.org';
TestObject.PORT = 443;

/**
 * Overrides the WD (admc/wd) prototype to force it to use TestObject
 */
TestObject.overrideWD = function (wd, appiumZipUrl) {
  const originalPromiseChainRemote = wd.promiseChainRemote;

  // Override the 'promiseChainRemote' method to use TestObject HOST and special caps
  wd.promiseChainRemote = async function (...args) {
    let testObjectParams = {
      host: TestObject.HOST,
      port: TestObject.PORT,
      https: true,
    };
    let driver;
    if (_.isObject(args[0])) {
      testObjectParams = Object.assign(args[0], testObjectParams);
    }
    driver = await originalPromiseChainRemote.call(wd, testObjectParams);

    const originalInit = driver.init;
    driver.init = async function (caps, ...args) {
      const extendedCaps = await TestObject.getTestObjectCaps(caps);
      logger.debug(`Setting caps.testobject_remote_appium_url to ${appiumZipUrl}`);
      logger.debug(`Re-wrote capabilities to ${JSON.stringify(extendedCaps)}`);
      extendedCaps.testobject_remote_appium_url = appiumZipUrl;
      logger.debug(`Waiting to connect to TestObject staging server (this can take several minutes)`);
      return await originalInit.call(driver, extendedCaps, ...args);
    };
    return driver;
  };

  return originalPromiseChainRemote;
};

/**
 * Uploads zip to S3 and overrides WD to use TO objects
 */
TestObject.enableTestObject = async function (wd, driverName, driverUrl, commitSHA) {
  const zipfileName = `${driverName}_${commitSHA}`;
  let s3Location;
  if (await S3.fileExists(zipfileName)) {
    logger.debug(`Reusing cached version of '${zipfileName}'`);
    s3Location = S3.getS3Location(zipfileName);
  } else {
    const gitUrl = `${driverUrl}#${commitSHA}`;
    const appiumZip = await TestObject.fetchAppium(driverName, gitUrl);
    logger.debug(`Uploading '${appiumZip}' to S3`);
    try {
      s3Location = await S3.uploadZip(appiumZip, zipfileName);
    } catch (e) {
      logger.error(`Could not upload '${appiumZip}' to S3. Reason: (${e.message})`);
      throw e;
    }
    logger.debug(`Uploading of '${appiumZip}' complete`);
    logger.debug(`Zip was uploaded to ${s3Location}`);
    await fs.rimraf(appiumZip);
  }

  // Overriding WD so it uses the appiumS3Object.Location
  return {
    wdOverride: TestObject.overrideWD(wd, s3Location),
    s3Location,
    wd,
  };
};

/**
 * Takes the object that was returned by enableTestObject and uses it to restore WD
 * and delete the zip from S3
 */
TestObject.disableTestObject = async function ({wdOverride, wd}) {
  wd.promiseChainRemote = wdOverride;
};

TestObject.fetchAppium = async function (driverName, driverUrl) {
  // Clone appium
  const tempdir = await tempDir.openDir();
  const pathToAppium = path.resolve(tempdir, 'appium');
  await fs.rimraf(pathToAppium);
  logger.debug('Cloning appium');
  await exec('git', ['clone', 'https://github.com/appium/appium.git'], {cwd: tempdir});
  logger.debug(`Cloned appium at ${tempdir}`);

  // Enforce 'https://' over 'git@' for driverUrl. 'git@' is unauthorized in CI.
  if (driverUrl.startsWith('git@')) {
    throw new Error(`Error in driver url: ${driverUrl}. Use https instead.`);
  }

  // Rewrite the package.json to use the branch
  logger.debug(`Rewriting ${driverName} in package.json to ${driverUrl}`);
  const packageJSON = require(path.resolve(pathToAppium, 'package.json'));
  packageJSON.dependencies[driverName] = driverUrl;
  await fs.writeFile(path.resolve(pathToAppium, 'package.json'), JSON.stringify(packageJSON));

  // Install node modules
  logger.debug(`Running 'npm install' at ${pathToAppium}`);
  await new B((resolve, reject) => {
    const proc = new SubProcess(process.env.APPVEYOR ? 'npm.cmd' : 'npm', ['install'], {cwd: pathToAppium});
    proc.on('output', (stdout, stderr) => {
      logger.debug('npm install: ', stdout);
      logger.error('npm install: ', stderr);
    });
    proc.on('exit', (code) => {
      if (code > 0) {
        logger.error(`Could not install NPM modules. Exited with code ${code}`);
        reject(code);
      } else {
        logger.debug('Done running npm install');
        resolve(code);
      }
    });
    proc.start();
  });

  // Run gulp transpile inside module
  try {
    logger.debug(`Running gulp transpile in ${driverName}`);
    await exec('gulp', ['transpile'], {cwd: path.resolve(pathToAppium, 'node_modules', driverName)});
  } catch (ign) { }

  // Zip it and return it
  const pathToAppiumCopy = path.resolve(tempdir, 'appium');
  const pathToZip = path.resolve(tempdir, 'appium.zip');

  // Zip appium using archiver library
  logger.debug(`Zipping ${pathToAppiumCopy} to ${pathToZip}`);
  const output = createWriteStream(pathToZip);
  const archive = archiver('zip');

  const promise = new B((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });
  archive.pipe(output);
  archive.directory(pathToAppiumCopy, false);
  archive.on('progress', (data) => {
    if (data.entries.processed % 100 === 0) {
      const percent = Math.round(data.entries.processed / data.entries.total * 10000) / 100;
      logger.debug(`Zipping ${percent}%`);
    }
  });
  archive.finalize();
  await promise;
  logger.debug(`Done zipping appium to ${pathToZip}`);
  return pathToZip;
};

TestObject.ANDROID_DEVICES = [
  'HTC_One_M8_real',
  'LG_Nexus_5x_real',
  'Motorola_Moto_E_2nd_gen_real',
  'Samsung_Galaxy_S6_real',
  'Samsung_Galaxy_S7_Edge_real',
  'Samsung_Galaxy_S8_real',
];

export default TestObject;
