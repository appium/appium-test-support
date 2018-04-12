import _ from 'lodash';

function stubEnv () {
  let envBackup;
  beforeEach(function () {
    envBackup = process.env; process.env = _.cloneDeep(process.env);
  });
  afterEach(function () {
    process.env = envBackup;
  });
}

export { stubEnv };
