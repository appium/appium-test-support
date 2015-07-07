// transpile:mocha

import {cloneEnv} from '../..';
import chai from 'chai';
import 'mochawait';

chai.should();
const expect = chai.expect;

describe('env-utils', () => {
  describe('cloneEnv', () => {
    cloneEnv();

    it('setting env variable', () => {
      process.env.ABC = 'abc';
    });

    it('env varible should not be set', () => {
      expect(process.env.ABC).not.to.exist;
    });
  });
});

