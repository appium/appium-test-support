appium-test-support
===================

A collection of test utility lib used across Appium packages.

[![Build Status](https://travis-ci.org/appium/appium-test-support.svg?branch=master)](https://travis-ci.org/appium/appium-test-support)
[![Coverage Status](https://coveralls.io/repos/appium/appium-test-support/badge.svg?branch=master&service=github)](https://coveralls.io/github/appium/appium-test-support?branch=master)

## Api

### cloneEnv

```js
import { cloneEnv } from 'appium-test-support';

describe('myTest', () => {
  cloneEnv();
  it('setting env variable', () => {
    // Changes to process.env will stay local
    process.env.ABC = 'abc';
  });
});
```

### newLogStub

```js
import { newLogStub } from 'appium-test-support';

describe('myTest', () => {
  let sandbox;
  // configure sandbox here...

  it('stubbing log', () => {
    let logStub = newLogStub(sandbox, log);
    log.info('Hello World!');
    log.warn(`The ${'sun'.yellow} is shining!`);
    logStub.output.should.equals([
      'info: Hello World!',
      `warn: The ${'sun'.yellow} is shining!`
    ].join('\n'));
  });
  it('stubbing log stripping colors', () => {
    let logStub = newLogStub(sandbox, log, {stripColors: true});
    log.info('Hello World!');
    log.warn(`The ${'sun'.yellow} is shining!`);
    logStub.output.should.equals([
      'info: Hello World!',
      'warn: The sun is shining!'
    ].join('\n'));
  });
});
```

### withSandbox

Use when mixing mocks, spies stubs...

```js
import { withSandbox } from 'appium-test-support';

let api = {
  abc: () => { return 'abc'; }
};

describe('MyTest', withSandbox({mocks: {api}}, (S) => {
  it('stubbing api, stubbing dog', () => {
    S.mocks.api.expects('abc').once().returns('efg');
    let dog = { bark: () => { return 'ouaf!'; } };
    S.sandbox.stub(dog, 'bark').returns('miaou');
    api.abc().should.equal('efg');
    dog.bark().should.equal('miaou');
    S.verify();
  });
}));
```

### withMocks

```js
import { withMocks, verify } from 'appium-test-support';

let api = {
  abc: () => { return 'abc'; }
};

describe('withMocks', withMocks({api}, (mocks) => {
  it('should mock api', () => {
    mocks.api.expects('abc').once().returns('efg');
    api.abc().should.equal('efg');
    verify(mocks);
  });
}));

describe('withMocks (+S)', withMocks({api}, (mocks, S) => {
  it('should mock api (+S)', () => {
    mocks.api.expects('abc').once().returns('efg');
    api.abc().should.equal('efg');
    S.verify();
  });
}));
```

## Watch

```
npm run watch
```

## Test

```
npm test
```
