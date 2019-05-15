// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const path = require('path');
const assert = require('yeoman-assert');
const testlab = require('@loopback/testlab');

const TestSandbox = testlab.TestSandbox;

const generator = path.join(__dirname, '../../../generators/interceptor');
const SANDBOX_FILES = require('../../fixtures/interceptor').SANDBOX_FILES;
const testUtils = require('../../test-utils');

// Test Sandbox
const SANDBOX_PATH = path.resolve(__dirname, '..', '.sandbox');
const sandbox = new TestSandbox(SANDBOX_PATH);

describe('lb4 interceptor', () => {
  beforeEach('reset sandbox', async () => {
    await sandbox.reset();
  });

  describe('valid generation of interceptors', () => {
    it('generates a basic interceptor from command line arguments', async () => {
      await testUtils
        .executeGenerator(generator)
        .inDir(SANDBOX_PATH, () =>
          testUtils.givenLBProject(SANDBOX_PATH, {
            additionalFiles: SANDBOX_FILES,
          }),
        )
        .withArguments('myInterceptor');
      verifyGeneratedScript();
    });

    it('generates a basic interceptor from CLI with group', async () => {
      await testUtils
        .executeGenerator(generator)
        .inDir(SANDBOX_PATH, () =>
          testUtils.givenLBProject(SANDBOX_PATH, {
            additionalFiles: SANDBOX_FILES,
          }),
        )
        .withArguments('myInterceptor --group myGroup');
      verifyGeneratedScript('myGroup');
    });

    it('generates a interceptor from a config file', async () => {
      await testUtils
        .executeGenerator(generator)
        .inDir(SANDBOX_PATH, () =>
          testUtils.givenLBProject(SANDBOX_PATH, {
            additionalFiles: SANDBOX_FILES,
          }),
        )
        .withArguments('--config myinterceptorconfig.json');
      verifyGeneratedScript();
    });
  });
});

// Sandbox constants
const SCRIPT_APP_PATH = 'src/interceptors';
const INDEX_FILE = path.join(SANDBOX_PATH, SCRIPT_APP_PATH, 'index.ts');

function verifyGeneratedScript(group = '') {
  const expectedFile = path.join(
    SANDBOX_PATH,
    SCRIPT_APP_PATH,
    'my-interceptor.interceptor.ts',
  );
  assert.file(expectedFile);
  assert.fileContent(expectedFile, 'bind');
  assert.fileContent(
    expectedFile,
    /export class MyInterceptorInterceptor implements Provider<Interceptor> {/,
  );
  assert.fileContent(expectedFile, `@bind(asGlobalInterceptor('${group}'))`);
  assert.fileContent(expectedFile, /value\(\) {/);
  assert.fileContent(expectedFile, /async \(invocationCtx, next\) => \{/);
  assert.file(INDEX_FILE);
  assert.fileContent(
    INDEX_FILE,
    /export \* from '.\/my-interceptor.interceptor';/,
  );
}
