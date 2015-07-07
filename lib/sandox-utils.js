import sinon from 'sinon';
import _ from 'lodash';

let SANDBOX = Symbol();

// use this one if using a mix of mocks/stub/spies
function withSandbox (config, fn) {
  return () => {
    let S = {
      mocks: {},
      verify: function() {
        return this.sandbox.verify();
      }
    };
    beforeEach(() => {
      S.sandbox = sinon.sandbox.create();
      S.mocks[SANDBOX] = S.sandbox;
      for (let [key, value] of _.pairs(config.mocks)) {
        S.mocks[key] = S.sandbox.mock(value);
      }
    });
    afterEach(() => {
      S.sandbox.restore();
      for (let k of _.keys(S.mocks)) {
        delete S.mocks[k];
      }
      delete S.mocks[SANDBOX];
    });
    fn(S);
  };
}

// use this if using only mocks
function withMocks (libs, fn) {
  return withSandbox({mocks: libs}, function(S) {
    fn(S.mocks, S);
  });
}

function verify(obj) {
  let sandbox = obj.sandbox ? obj.sandbox : obj[SANDBOX];
  sandbox.verify();
}

export { withSandbox, withMocks, verify };
