// transpile:mocha

import { newLogStub } from '../..';
import log from '../lib/logger';
import sinon from 'sinon';
import 'colors';

import chai from 'chai';
import 'mochawait';

chai.should();

describe('log-utils', () => {
  describe('newLogStub', () => {
    let sandbox;
    before(() => {
      sandbox = sinon.sandbox.create();
    });
    after(() => {
      sandbox.restore();
    });
    it('should stub log', () => {
      let logStub = newLogStub(sandbox, log);
      log.info('Hello World!');
      log.warn(`The ${'sun'.yellow} is shining!`);
      logStub.output.should.equals([
        'info: Hello World!',
        `warn: The ${'sun'.yellow} is shining!`
      ].join('\n'));
    });
    it('should stub log and strip colors', () => {
      let logStub = newLogStub(sandbox, log, {stripColors: true});
      log.info('Hello World!');
      log.warn(`The ${'sun'.yellow} is shining!`);
      logStub.output.should.equals([
        'info: Hello World!',
        'warn: The sun is shining!'
      ].join('\n'));
    });
  });
});

