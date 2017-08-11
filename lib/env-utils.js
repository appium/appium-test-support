import _ from 'lodash';

function stubEnv () {
  let envBackup;
  beforeEach(() => { envBackup = process.env; process.env = _.cloneDeep(process.env); });
  afterEach(() => { process.env = envBackup; });
}

export { stubEnv };
