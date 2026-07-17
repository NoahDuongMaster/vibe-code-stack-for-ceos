import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(resolve(ROOT_DIR, 'package.json'), 'utf8'),
);
const miseConfig = readFileSync(resolve(ROOT_DIR, 'mise.toml'), 'utf8');

const ROUTED_TASKS = [
  'dev',
  'dev:web',
  'dev:admin',
  'dev:landing',
  'dev:api',
  'dev:gateway',
  'dev:backend',
  'format',
  'check',
  'check:ci',
  'typecheck',
  'lint',
  'test',
  'test:e2e',
  'build',
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getTaskBlock = (taskName) => {
  const escapedTaskName = escapeRegExp(taskName);
  const header = taskName.includes(':')
    ? `\\[tasks\\."${escapedTaskName}"\\]`
    : `\\[tasks\\.${escapedTaskName}\\]`;
  const match = miseConfig.match(
    new RegExp(`${header}([\\s\\S]*?)(?=\\n\\[tasks\\.|$)`),
  );

  assert.ok(match, `Missing mise task: ${taskName}`);
  return match[1];
};

test('should route public root scripts through mise without recursion', () => {
  for (const taskName of ROUTED_TASKS) {
    assert.equal(packageJson.scripts[taskName], `mise run ${taskName}`);

    const internalScript = packageJson.scripts[`internal:${taskName}`];
    assert.ok(internalScript, `Missing internal:${taskName} script`);
    assert.doesNotMatch(internalScript, /\bmise\b/);

    assert.match(
      getTaskBlock(taskName),
      new RegExp(`run = "pnpm internal:${escapeRegExp(taskName)}"`),
    );
  }
});

test('should install frozen dependencies only through mise setup', () => {
  assert.equal(packageJson.scripts.preinstall, undefined);
  assert.equal(packageJson.scripts['pnpm:devPreinstall'], undefined);
  assert.match(
    readFileSync(resolve(ROOT_DIR, '.pnpmfile.mjs'), 'utf8'),
    /validateInstallContext/,
  );
  assert.match(getTaskBlock('setup'), /run = "pnpm install --frozen-lockfile"/);
  assert.doesNotMatch(miseConfig, /\[tasks\.install\]/);
});

test('should compose verification from sequential mise task references', () => {
  assert.match(
    getTaskBlock('verify'),
    /task = "typecheck"[\s\S]*task = "check:ci"[\s\S]*task = "lint"[\s\S]*task = "test"[\s\S]*task = "build"/,
  );
});

test('should install dependencies once through the shared CI setup action', () => {
  const setupAction = readFileSync(
    resolve(ROOT_DIR, '.github/actions/setup-toolchain/action.yml'),
    'utf8',
  );
  const workflowPaths = [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy.yml',
    '.github/workflows/playwright.yml',
  ];

  assert.match(setupAction, /run: mise run setup/);

  for (const workflowPath of workflowPaths) {
    const workflow = readFileSync(resolve(ROOT_DIR, workflowPath), 'utf8');
    assert.doesNotMatch(workflow, /pnpm install --frozen-lockfile/);
  }
});
