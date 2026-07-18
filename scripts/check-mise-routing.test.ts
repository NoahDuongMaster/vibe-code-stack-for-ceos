import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

type TPackageJson = {
  scripts: Record<string, string>;
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  readFileSync(resolve(ROOT_DIR, 'package.json'), 'utf8'),
) as TPackageJson;
const miseConfig = readFileSync(resolve(ROOT_DIR, 'mise.toml'), 'utf8');

const ROUTED_TASKS = [
  'dev',
  'dev:web',
  'dev:admin',
  'dev:landing',
  'dev:api',
  'dev:admin-api',
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
] as const;

const DOCKER_START_TASKS = {
  'docker:start:dapp': 'make start-dapp-development',
  'docker:start:admin': 'make start-admin-development',
  'docker:start:landing': 'make start-landing-development',
  'docker:start:api-gateway': 'make start-api-gateway-development',
  'docker:start:admin-rpc': 'make start-admin-rpc-development',
  'docker:start:trading-rpc': 'make start-trading-rpc-development',
} as const;

const TYPESCRIPT_SCRIPT_MIGRATIONS = {
  'scripts/check-toolchain.mjs': 'scripts/check-toolchain.ts',
  'scripts/check-toolchain.test.mjs': 'scripts/check-toolchain.test.ts',
  'scripts/check-install-context.mjs': 'scripts/check-install-context.ts',
  'scripts/check-install-context.test.mjs':
    'scripts/check-install-context.test.ts',
  'scripts/check-mise-routing.test.mjs': 'scripts/check-mise-routing.test.ts',
} as const;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getTaskBlock = (taskName: string): string => {
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

test('should expose one mise start task per Docker development service', () => {
  for (const [taskName, command] of Object.entries(DOCKER_START_TASKS)) {
    assert.match(
      getTaskBlock(taskName),
      new RegExp(`run = "${escapeRegExp(command)}"`),
    );
  }
});

test('should execute mise-specific repository tooling from TypeScript', () => {
  assert.equal(
    packageJson.scripts['internal:test'],
    'node --test scripts/*.test.ts && turbo run test',
  );
  assert.match(
    getTaskBlock('toolchain:check'),
    /run = "node scripts\/check-toolchain\.ts"/,
  );
  assert.match(
    readFileSync(resolve(ROOT_DIR, '.pnpmfile.mjs'), 'utf8'),
    /check-install-context\.ts/,
  );

  for (const [legacyPath, typescriptPath] of Object.entries(
    TYPESCRIPT_SCRIPT_MIGRATIONS,
  )) {
    assert.equal(existsSync(resolve(ROOT_DIR, legacyPath)), false, legacyPath);
    assert.equal(
      existsSync(resolve(ROOT_DIR, typescriptPath)),
      true,
      typescriptPath,
    );
  }
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
