// transpile:mocha

import { stubLog } from '..';
import log from '../lib/logger';
import sinon from 'sinon';
import 'colors';

import chai from 'chai';


chai.should();

describe('log-utils', () => {
  describe('stubLog', () => {
    let sandbox;
    beforeEach(() => {
      sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should stub log', () => {
      let logStub = stubLog(sandbox, log);
      log.info('Hello World!');
      log.warn(`The ${'sun'.yellow} is shining!`);
      logStub.output.should.equals([
        'info: Hello World!',
        `warn: The ${'sun'.yellow} is shining!`
      ].join('\n'));
    });
    it('should stub log and strip colors', () => {
      let logStub = stubLog(sandbox, log, {stripColors: true});
      log.info('Hello World!');
      log.warn(`The ${'sun'.yellow} is shining!`);
      logStub.output.should.equals([
        'info: Hello World!',
        'warn: The sun is shining!'
      ].join('\n'));
    });
  });
});

