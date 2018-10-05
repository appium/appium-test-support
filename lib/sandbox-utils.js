import sinon from 'sinon';
import _ from 'lodash';

let SANDBOX = Symbol();

// use this one if using a mix of mocks/stub/spies
function withSandbox (config, fn) {
  return () => {
    const S = {
      mocks: {},
      verify () {
        return this.sandbox.verify();
      },
    };
    beforeEach(function () {
      S.sandbox = sinon.createSandbox();
      S.mocks[SANDBOX] = S.sandbox;
      for (let [key, value] of _.toPairs(config.mocks)) {
        S.mocks[key] = S.sandbox.mock(value);
      }
    });
    afterEach(function () {
      S.sandbox.restore();
      for (let k of _.keys(S.mocks)) {
        delete S.mocks[k];
      }
      delete S.mocks[SANDBOX];
    });
    fn(S);
  };
}

function verifySandbox (obj) {
  let sandbox = obj.sandbox ? obj.sandbox : obj[SANDBOX];
  sandbox.verify();
}

export { withSandbox, verifySandbox };
