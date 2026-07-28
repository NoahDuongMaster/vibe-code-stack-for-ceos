import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readRootFile = (path: string): string =>
  readFileSync(resolve(ROOT_DIR, path), 'utf8');
const miseConfig = readRootFile('mise.toml');

const parseEnvironmentSample = (path: string): Record<string, string> =>
  Object.fromEntries(
    readRootFile(path)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        assert.notEqual(separatorIndex, -1, `${path} contains an invalid line`);
        return [
          line.slice(0, separatorIndex),
          line.slice(separatorIndex + 1).replace(/^['"]|['"]$/gu, ''),
        ];
      }),
  );

const assertUrl = (value: string, label: string): URL => {
  assert.ok(value, `${label} must not be empty`);
  return new URL(value);
};

const getEnvironmentValue = (
  environment: Readonly<Record<string, string>>,
  name: string,
): string => {
  const value = environment[name];
  assert.ok(value, `Missing environment value: ${name}`);
  return value;
};

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
  const block = match[1];
  assert.ok(block, `Missing mise task body: ${taskName}`);
  return block;
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

test('should keep copied environment samples aligned with the local port namespace', () => {
  const repositoryEnvironment = parseEnvironmentSample('.env.sample');
  const dappEnvironment = parseEnvironmentSample('apps/dapp/.env.sample');
  const dappWorkerEnvironment = parseEnvironmentSample(
    'apps/dapp/.dev.vars.sample',
  );
  const adminEnvironment = parseEnvironmentSample('apps/admin/.env.sample');
  const landingEnvironment = parseEnvironmentSample('apps/landing/.env.sample');
  const tradingRpcEnvironment = parseEnvironmentSample(
    'services/trading-rpc/.env.sample',
  );
  const adminRpcEnvironment = parseEnvironmentSample(
    'services/admin-rpc/.env.sample',
  );

  const expectedRepositoryPorts = {
    DAPP_HOST_PORT: '46000',
    ADMIN_HOST_PORT: '46001',
    LANDING_HOST_PORT: '46002',
    API_GATEWAY_HOST_PORT: '46003',
    TRADING_RPC_HTTP_HOST_PORT: '46104',
    TRADING_RPC_GRPC_HOST_PORT: '46105',
    ADMIN_RPC_HTTP_HOST_PORT: '46106',
    ADMIN_RPC_GRPC_HOST_PORT: '46107',
    POSTGRES_HOST_PORT: '46008',
    STAGING_DAPP_HOST_PORT: '46200',
  } as const;

  for (const [name, port] of Object.entries(expectedRepositoryPorts)) {
    assert.equal(repositoryEnvironment[name], port);
  }
  const portValues = Object.values(expectedRepositoryPorts).map(Number);
  assert.equal(new Set(portValues).size, portValues.length);
  assert.ok(portValues.every((port) => port >= 46_000 && port <= 46_299));

  assert.equal(
    dappEnvironment.NEXT_PUBLIC_API_ENDPOINT,
    'http://localhost:46003',
  );
  assert.equal(
    dappEnvironment.NEXT_PUBLIC_PROJECT_NAME,
    'vibe-code-stack-for-ceos',
  );
  assert.equal(dappEnvironment.NEXT_PUBLIC_BASE_URL, 'http://localhost:46000');
  assert.equal(
    dappWorkerEnvironment.NEXT_PUBLIC_API_ENDPOINT,
    dappEnvironment.NEXT_PUBLIC_API_ENDPOINT,
  );
  assert.equal(
    dappWorkerEnvironment.NEXT_PUBLIC_BASE_URL,
    dappEnvironment.NEXT_PUBLIC_BASE_URL,
  );
  assert.equal(
    dappWorkerEnvironment.SESSION_SECRET,
    dappEnvironment.SESSION_SECRET,
  );
  assert.ok(
    getEnvironmentValue(dappEnvironment, 'SESSION_SECRET').length >= 32,
  );
  assert.ok(dappEnvironment.DEMO_AUTH_EMAIL);
  assert.ok(dappEnvironment.DEMO_AUTH_PASSWORD);
  assertUrl(
    getEnvironmentValue(dappEnvironment, 'NEXT_PUBLIC_API_ENDPOINT'),
    'dapp API endpoint',
  );
  assertUrl(
    getEnvironmentValue(dappEnvironment, 'NEXT_PUBLIC_BASE_URL'),
    'dapp base URL',
  );

  assert.equal(adminEnvironment.PUBLIC_API_URL, 'http://localhost:46003');
  assertUrl(
    getEnvironmentValue(adminEnvironment, 'PUBLIC_API_URL'),
    'admin API endpoint',
  );
  assert.equal(landingEnvironment.PUBLIC_SITE_URL, 'http://localhost:46002');
  assertUrl(
    getEnvironmentValue(landingEnvironment, 'PUBLIC_SITE_URL'),
    'landing site URL',
  );

  assert.equal(tradingRpcEnvironment.PORT, '46004');
  assert.equal(tradingRpcEnvironment.GRPC_PORT, '46005');
  assert.equal(tradingRpcEnvironment.SERVICE_NAME, 'trading-rpc');
  assert.equal(
    assertUrl(
      getEnvironmentValue(tradingRpcEnvironment, 'DATABASE_URL'),
      'trading database URL',
    ).port,
    '46008',
  );
  assert.equal(adminRpcEnvironment.PORT, '46006');
  assert.equal(adminRpcEnvironment.GRPC_PORT, '46007');
  assert.equal(adminRpcEnvironment.SERVICE_NAME, 'admin-rpc');
  assert.equal(
    assertUrl(
      getEnvironmentValue(adminRpcEnvironment, 'TRADING_RPC_GRPC_URL'),
      'admin downstream gRPC URL',
    ).port,
    '46005',
  );
});

test('should isolate native services from the Docker VPC origin ports', () => {
  const makefile = readRootFile('Makefile');
  assert.match(makefile, /^start-postgres-development:/m);
  assert.match(makefile, /^start-native-development-infra:/m);
  assert.match(makefile, /^stop-native-development-infra:/m);
  assert.doesNotMatch(makefile, /NATIVE_DEV_TRADING_RPC_GRPC_HOST_PORT/);

  const composeDevelopment = readRootFile('infra/docker/compose.dev.yaml');
  const composeBase = readRootFile('infra/docker/compose.yaml');
  assert.match(composeDevelopment, /DAPP_HOST_PORT:-46000}:3000/);
  assert.match(composeDevelopment, /TRADING_RPC_HTTP_HOST_PORT:-46104}:3001/);
  assert.match(composeDevelopment, /TRADING_RPC_GRPC_HOST_PORT:-46105}:50051/);
  assert.match(composeDevelopment, /^ {6}PORT: 3001$/m);
  assert.match(composeDevelopment, /^ {6}GRPC_PORT: 50051$/m);
  assert.match(composeDevelopment, /ADMIN_RPC_HTTP_HOST_PORT:-46106}:3001/);
  assert.match(composeDevelopment, /ADMIN_RPC_GRPC_HOST_PORT:-46107}:50051/);
  assert.match(composeDevelopment, /POSTGRES_HOST_PORT:-46008}:5432/);
  assert.match(composeBase, /ADMIN_HOST_PORT:-46001}:3002/);
  assert.match(composeBase, /LANDING_HOST_PORT:-46002}:4321/);
  assert.match(composeBase, /API_GATEWAY_HOST_PORT:-46003}:8787/);

  const gatewayWranglerConfig = readRootFile(
    'services/api-gateway/wrangler.jsonc',
  );
  assert.match(
    gatewayWranglerConfig,
    /http:\/\/localhost:46000,http:\/\/localhost:46001,http:\/\/localhost:46002/,
  );

  const adminConfig = readRootFile('apps/admin/rsbuild.config.ts');
  assert.match(adminConfig, /port: 46001/);
  assert.match(adminConfig, /strictPort: true/);

  const dappConfig = readRootFile('apps/dapp/vite.config.ts');
  assert.match(dappConfig, /inspectorPort: 46009/);
  assert.match(dappConfig, /port: 46000/);
  assert.match(dappConfig, /strictPort: true/);

  const landingConfig = readRootFile('apps/landing/astro.config.ts');
  assert.match(landingConfig, /port: 46002/);
  assert.match(landingConfig, /strictPort: true/);

  const gatewayConfig = readRootFile('services/api-gateway/vite.config.ts');
  assert.match(gatewayConfig, /inspectorPort: 46010/);
  assert.match(gatewayConfig, /port: 46003/);
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
