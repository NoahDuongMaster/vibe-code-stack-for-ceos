import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readRootFile = (path: string): string =>
  readFileSync(resolve(ROOT_DIR, path), 'utf8');
const miseConfig = readRootFile('mise.toml');

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

test('should provision the required infrastructure before native services', () => {
  assert.match(getTaskBlock('dev'), /depends = \["dev:infra"\]/);
  assert.match(getTaskBlock('dev:api'), /depends = \["dev:database"\]/);
  assert.match(getTaskBlock('dev:gateway'), /depends = \["dev:infra"\]/);
  assert.match(getTaskBlock('dev:backend'), /depends = \["dev:infra"\]/);
  assert.match(getTaskBlock('dev:database'), /make start-postgres-development/);
  assert.match(
    getTaskBlock('dev:infra'),
    /make start-native-development-infra/,
  );
  assert.match(
    getTaskBlock('dev:infra:stop'),
    /make stop-native-development-infra/,
  );
});

test('should isolate native and container development ports', () => {
  const makefile = readRootFile('Makefile');
  assert.match(makefile, /^start-postgres-development:/m);
  assert.match(makefile, /^start-native-development-infra:/m);
  assert.match(makefile, /^stop-native-development-infra:/m);
  assert.match(makefile, /NATIVE_DEV_TRADING_RPC_GRPC_HOST_PORT \?= 50052/);

  const adminRpcEnvironment = readRootFile('services/admin-rpc/.env.sample');
  assert.match(adminRpcEnvironment, /^PORT=3004$/m);
  assert.match(adminRpcEnvironment, /^GRPC_PORT=50053$/m);
  assert.match(
    adminRpcEnvironment,
    /^TRADING_RPC_GRPC_URL=http:\/\/127\.0\.0\.1:50051$/m,
  );

  const composeDevelopment = readRootFile('infra/docker/compose.dev.yaml');
  assert.match(composeDevelopment, /ADMIN_RPC_GRPC_HOST_PORT:-50052}:50051/);

  const adminConfig = readRootFile('apps/admin/rsbuild.config.ts');
  assert.match(adminConfig, /port: 3002/);
  assert.match(adminConfig, /strictPort: true/);

  const dappConfig = readRootFile('apps/dapp/vite.config.ts');
  assert.match(dappConfig, /inspectorPort: 9229/);
  assert.match(dappConfig, /port: 3000/);
  assert.match(dappConfig, /strictPort: true/);

  const gatewayConfig = readRootFile('services/api-gateway/vite.config.ts');
  assert.match(gatewayConfig, /inspectorPort: 9230/);
  assert.match(gatewayConfig, /port: 8787/);
  assert.match(gatewayConfig, /strictPort: true/);
});

test('should provide the pnpm policy hook to frozen Docker installs', () => {
  const dockerfiles = [
    'infra/docker/admin-rpc.Dockerfile',
    'infra/docker/dapp.Dockerfile',
    'infra/docker/trading-rpc.Dockerfile',
    'infra/docker/workspace-dev.Dockerfile',
  ];

  for (const dockerfile of dockerfiles) {
    const stages = readRootFile(dockerfile)
      .split(/^FROM /m)
      .slice(1);

    for (const stage of stages) {
      if (!stage.includes('pnpm install --frozen-lockfile')) continue;

      const installPrefix = stage.slice(
        0,
        stage.indexOf('pnpm install --frozen-lockfile'),
      );
      assert.match(
        installPrefix,
        /COPY \.pnpmfile\.mjs/,
        `${dockerfile} must copy .pnpmfile.mjs before a frozen install`,
      );
      assert.match(
        installPrefix,
        /COPY scripts\/check-install-context\.ts/,
        `${dockerfile} must copy the install policy imported by .pnpmfile.mjs`,
      );
      assert.match(
        stage,
        /RUN MISE_TASK_NAME=setup pnpm install --frozen-lockfile/,
        `${dockerfile} must authorize its internal frozen install`,
      );
    }
  }
});
