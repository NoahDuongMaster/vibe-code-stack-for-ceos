import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkGatewayArchitecture } from '@scripts/check-architecture';

const createFixture = async (files: Readonly<Record<string, string>>) => {
  const root = await mkdtemp(join(tmpdir(), 'api-gateway-architecture-'));
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
  const violations = await checkGatewayArchitecture(root);
  return {
    status: violations.length === 0 ? 0 : 1,
    stderr: violations.join('\n'),
    stdout: violations.length === 0 ? 'PASS' : '',
  };
};

test('accepts feature-owned adapters and root composition through Public APIs', async () => {
  const root = await createFixture({
    'features/access-control/application/authorize.ts':
      'export const authorize = () => true;\n',
    'features/access-control/adapters/http/auth.middleware.ts':
      "import { authorize } from '@/features/access-control/application/authorize';\nexport const auth = authorize;\n",
    'features/access-control/index.ts':
      "export { auth } from '@/features/access-control/adapters/http/auth.middleware';\n",
    'adapters/http/gateway-app.ts':
      "import { auth } from '@/features/access-control';\nvoid auth;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects relative source imports', async () => {
  const root = await createFixture({
    'features/access-control/application/authorize.ts':
      "import { token } from './token';\nvoid token;\n",
    'features/access-control/application/token.ts':
      "export const token = 'token';\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /uses forbidden relative import.*\.\/token/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects feature adapters importing root runtime modules', async () => {
  const root = await createFixture({
    'adapters/http/gateway-app-env.ts': 'export const env = {};\n',
    'features/access-control/adapters/http/auth.middleware.ts':
      "import { env } from '@/adapters/http/gateway-app-env';\nvoid env;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /adapters\/http\/auth\.middleware\.ts imports forbidden root runtime module/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects root production deep imports into a feature', async () => {
  const root = await createFixture({
    'features/rpc-routing/application/route.ts':
      'export const route = () => true;\n',
    'adapters/http/gateway-app.ts':
      "import { route } from '@/features/rpc-routing/application/route';\nvoid route;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /deep-imports the rpc-routing feature/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects imports between gateway capabilities', async () => {
  const root = await createFixture({
    'features/access-control/application/authorize.ts':
      'export const authorize = () => true;\n',
    'features/rate-limiting/application/enforce.ts':
      "import { authorize } from '@/features/access-control/application/authorize';\nvoid authorize;\n",
  });

  try {
    const result = await runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /imports another feature.*access-control/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
