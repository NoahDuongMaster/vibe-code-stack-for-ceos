import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkTradingRpcArchitecture } from '@scripts/check-architecture';

const createFixture = async (files: Readonly<Record<string, string>>) => {
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

const runChecker = async (root: string) => {
  const violations = await checkTradingRpcArchitecture(root);
  return {
    status: violations.length === 0 ? 0 : 1,
    stderr: violations.join('\n'),
    stdout: violations.length === 0 ? 'PASS' : '',
  };
};

test('accepts inward feature dependencies and public API root imports', async () => {
  const root = await createFixture({
    'features/market-data/domain/coin-id.ts':
      "export const coinId = 'bitcoin';\n",
    'features/market-data/application/get-markets.ts':
      "import { coinId } from '@/features/market-data/domain/coin-id';\nexport const getMarkets = () => coinId;\n",
    'features/market-data/adapters/connect/routes.ts':
      "import { getMarkets } from '@/features/market-data/application/get-markets';\nexport const routes = getMarkets;\n",
    'features/market-data/infra/coingecko/adapter.ts':
      "import { coinId } from '@/features/market-data/domain/coin-id';\nexport const adapter = coinId;\n",
    'features/market-data/index.ts':
      "export { routes } from '@/features/market-data/adapters/connect/routes';\n",
    'index.ts':
      "import { routes } from '@/features/market-data';\nvoid routes;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects domain imports outside the feature domain', async () => {
  const root = await createFixture({
    'config/runtime-config.ts': 'export const config = {};\n',
    'features/market-data/domain/coin-id.ts':
      "import { config } from '@/config/runtime-config';\nvoid config;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /domain\/coin-id\.ts imports outside the feature domain.*runtime-config/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects application runtime dependencies', async () => {
  const root = await createFixture({
    'features/market-data/application/get-markets.ts':
      "import Fastify from 'fastify';\nvoid Fastify;\n",
  });

  try {
    const result = await runChecker(root);
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
    'features/market-data/adapters/connect/routes.ts':
      "import { config } from '@/config/runtime-config';\nvoid config;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /adapters\/connect\/routes\.ts imports forbidden root runtime module.*runtime-config/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects feature gRPC adapters importing the root Nest platform', async () => {
  const root = await createFixture({
    'platform/nest/trading-rpc.module.ts':
      'export const tradingRpcModule = {};\n',
    'features/market-data/adapters/grpc/controller.ts':
      "import { tradingRpcModule } from '@/platform/nest/trading-rpc.module';\nvoid tradingRpcModule;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /adapters\/grpc\/controller\.ts imports forbidden root runtime module.*platform\/nest/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects root production deep imports but allows direct imports in tests', async () => {
  const root = await createFixture({
    'features/market-data/domain/coin-id.ts':
      "export const coinId = 'bitcoin';\n",
    'index.ts':
      "import { coinId } from '@/features/market-data/domain/coin-id';\nvoid coinId;\n",
    'rpc.smoke.test.ts':
      "import { coinId } from '@/features/market-data/domain/coin-id';\nvoid coinId;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /index\.ts deep-imports the market-data feature.*coin-id/,
    );
    assert.doesNotMatch(result.stderr, /rpc\.smoke\.test\.ts/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('resolves the source alias when enforcing runtime and public API boundaries', async () => {
  const root = await createFixture({
    'config/runtime-config.ts': 'export const config = {};\n',
    'features/market-data/domain/coin-id.ts':
      "export const coinId = 'bitcoin';\n",
    'features/market-data/adapters/connect/routes.ts':
      "import { config } from '@/config/runtime-config';\nvoid config;\n",
    'index.ts':
      "import { coinId } from '@/features/market-data/domain/coin-id';\nvoid coinId;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden root runtime module/);
    assert.match(result.stderr, /deep-imports the market-data feature/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('discovers and validates every feature without a hardcoded allowlist', async () => {
  const root = await createFixture({
    'features/portfolio/application/get-portfolio.ts':
      "import Fastify from 'fastify';\nvoid Fastify;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/portfolio\/application\/get-portfolio\.ts imports forbidden runtime dependency "fastify"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects imports between feature slices', async () => {
  const root = await createFixture({
    'features/market-data/domain/coin-id.ts':
      "export const coinId = 'bitcoin';\n",
    'features/portfolio/application/get-portfolio.ts':
      "import { coinId } from '@/features/market-data/domain/coin-id';\nvoid coinId;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/portfolio\/application\/get-portfolio\.ts imports another feature.*market-data/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects relative imports so source files consistently use aliases', async () => {
  const root = await createFixture({
    'features/market-data/domain/errors.ts':
      'export class MarketDataError extends Error {}\n',
    'features/market-data/domain/coin-id.ts':
      "import { MarketDataError } from './errors';\nvoid MarketDataError;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/market-data\/domain\/coin-id\.ts uses forbidden relative import.*\.\/errors/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
