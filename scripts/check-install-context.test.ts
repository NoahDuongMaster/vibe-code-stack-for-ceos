import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

type TPnpmHooks = {
  updateConfig: <TConfig extends object>(config: TConfig) => TConfig;
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD_PATH = resolve(ROOT_DIR, 'scripts/check-install-context.ts');
const PNPMFILE_PATH = resolve(ROOT_DIR, '.pnpmfile.mjs');
const REPLACEMENT_MESSAGE = 'Run `mise setup` instead of `pnpm install`.';

const runGuard = (taskName: string | undefined) => {
  const env = { ...process.env };

  if (taskName === undefined) delete env.MISE_TASK_NAME;
  else env.MISE_TASK_NAME = taskName;

  return spawnSync(process.execPath, [GUARD_PATH], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    env,
  });
};

test('should allow dependency installation from the mise setup task', () => {
  const result = runGuard('setup');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
});

test('should reject dependency installation without a mise task', () => {
  const result = runGuard(undefined);

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), REPLACEMENT_MESSAGE);
});

test('should reject dependency installation from another mise task', () => {
  const result = runGuard('dev');

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), REPLACEMENT_MESSAGE);
});

test('should enforce the guard from the pnpm install hook', async () => {
  let hooks: TPnpmHooks;

  try {
    ({ hooks } = (await import(PNPMFILE_PATH)) as { hooks: TPnpmHooks });
  } catch (error) {
    assert.fail(`Unable to load .pnpmfile.mjs: ${error}`);
  }

  const originalArgv = process.argv;
  const originalTaskName = process.env.MISE_TASK_NAME;

  try {
    process.argv = [process.execPath, 'pnpm', 'install'];
    delete process.env.MISE_TASK_NAME;
    assert.throws(() => hooks.updateConfig({}), {
      message: REPLACEMENT_MESSAGE,
    });

    process.env.MISE_TASK_NAME = 'setup';
    const config = {};
    assert.equal(hooks.updateConfig(config), config);

    delete process.env.MISE_TASK_NAME;
    process.argv = [
      process.execPath,
      'pnpm',
      '--filter',
      '@apps/dapp',
      'exec',
      'playwright',
      'install',
      'chromium',
    ];
    assert.equal(
      hooks.updateConfig(config),
      config,
      'tool subcommands named install must not be mistaken for pnpm install',
    );

    process.argv = [
      process.execPath,
      'pnpm',
      '--filter',
      '@apps/dapp',
      'install',
    ];
    assert.throws(() => hooks.updateConfig(config), {
      message: REPLACEMENT_MESSAGE,
    });
  } finally {
    process.argv = originalArgv;
    if (originalTaskName === undefined) delete process.env.MISE_TASK_NAME;
    else process.env.MISE_TASK_NAME = originalTaskName;
  }
});
