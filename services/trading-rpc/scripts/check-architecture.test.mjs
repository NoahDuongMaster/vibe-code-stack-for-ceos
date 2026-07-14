import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CHECKER = fileURLToPath(
  new URL('./check-architecture.mjs', import.meta.url),
);

const createFixture = async (files) => {
  const root = await mkdtemp(join(tmpdir(), 'trading-rpc-architecture-'));
  await Promise.all(
    Object.entries(files).map(async ([path, source]) => {
      const file = join(root, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, source);
    }),
  );
  return root;
};

const runChecker = (root) =>
  spawnSync(process.execPath, [CHECKER, root], {
    encoding: 'utf8',
  });

test('accepts inward feature dependencies and public API root imports', async () => {
  const root = await createFixture({
    'features/get-crypto-markets/domain/coin-id.ts':
      "export const coinId = 'bitcoin';\n",
    'features/get-crypto-markets/application/get-markets.ts':
      "import { coinId } from '../domain/coin-id.js';\nexport const getMarkets = () => coinId;\n",
    'features/get-crypto-markets/adapters/connect/routes.ts':
      "import { getMarkets } from '../../application/get-markets.js';\nexport const routes = getMarkets;\n",
    'features/get-crypto-markets/infra/coingecko/adapter.ts':
      "import { coinId } from '../../domain/coin-id.js';\nexport const adapter = coinId;\n",
    'features/get-crypto-markets/index.ts':
      "export { routes } from './adapters/connect/routes.js';\n",
    'index.ts':
      "import { routes } from './features/get-crypto-markets/index.js';\nvoid routes;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects domain imports outside the feature domain', async () => {
  const root = await createFixture({
    'config/runtime-config.ts': 'export const config = {};\n',
    'features/get-crypto-markets/domain/coin-id.ts':
      "import { config } from '../../../config/runtime-config.js';\nvoid config;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /domain\/coin-id\.ts imports outside the feature domain.*runtime-config\.js/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects application runtime dependencies', async () => {
  const root = await createFixture({
    'features/get-crypto-markets/application/get-markets.ts':
      "import Fastify from 'fastify';\nvoid Fastify;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /application\/get-markets\.ts imports forbidden runtime dependency "fastify"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects feature adapters importing root runtime modules', async () => {
  const root = await createFixture({
    'config/runtime-config.ts': 'export const config = {};\n',
    'features/get-crypto-markets/adapters/connect/routes.ts':
      "import { config } from '../../../../config/runtime-config.js';\nvoid config;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /adapters\/connect\/routes\.ts imports forbidden root runtime module.*runtime-config\.js/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects root production deep imports but allows direct imports in tests', async () => {
  const root = await createFixture({
    'features/get-crypto-markets/domain/coin-id.ts':
      "export const coinId = 'bitcoin';\n",
    'index.ts':
      "import { coinId } from './features/get-crypto-markets/domain/coin-id.js';\nvoid coinId;\n",
    'rpc.smoke.test.ts':
      "import { coinId } from './features/get-crypto-markets/domain/coin-id.js';\nvoid coinId;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /index\.ts deep-imports the get-crypto-markets feature.*coin-id\.js/,
    );
    assert.doesNotMatch(result.stderr, /rpc\.smoke\.test\.ts/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('resolves the source alias when enforcing runtime and public API boundaries', async () => {
  const root = await createFixture({
    'config/runtime-config.ts': 'export const config = {};\n',
    'features/get-crypto-markets/domain/coin-id.ts':
      "export const coinId = 'bitcoin';\n",
    'features/get-crypto-markets/adapters/connect/routes.ts':
      "import { config } from '@/config/runtime-config.js';\nvoid config;\n",
    'index.ts':
      "import { coinId } from '@/features/get-crypto-markets/domain/coin-id.js';\nvoid coinId;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden root runtime module/);
    assert.match(result.stderr, /deep-imports the get-crypto-markets feature/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
