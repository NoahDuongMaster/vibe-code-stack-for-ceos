import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CHECKER = fileURLToPath(
  new URL('./check-architecture.ts', import.meta.url),
);

const createFixture = async (
  files: Readonly<Record<string, string>>,
): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'api-core-architecture-'));
  await Promise.all(
    Object.entries(files).map(async ([path, source]) => {
      const file = join(root, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, source);
    }),
  );
  return root;
};

const runChecker = (root: string) =>
  spawnSync(process.execPath, [CHECKER, root], {
    encoding: 'utf8',
  });

test('accepts adapters that compose feature public APIs and shared utilities', async () => {
  const root = await createFixture({
    'shared/config.ts': 'export const config = {};\n',
    'features/alpha/index.ts': "export const alpha = 'alpha';\n",
    'adapters/connect/routes.ts':
      "import { alpha } from '../../features/alpha/index.js';\nimport { config } from '../../shared/config.js';\nvoid alpha;\nvoid config;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects feature imports from the outer adapter layer', async () => {
  const root = await createFixture({
    'adapters/connect/routes.ts': 'export const routes = {};\n',
    'features/alpha/alpha.service.ts':
      "import { routes } from '../../adapters/connect/routes.js';\nvoid routes;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/alpha\/alpha\.service\.ts imports forbidden outer dependency.*adapters\/connect\/routes\.js/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects shared code that imports Connect transport types', async () => {
  const root = await createFixture({
    'shared/errors.ts':
      "import { ConnectError } from '@connectrpc/connect';\nvoid ConnectError;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /shared\/errors\.ts imports forbidden outer dependency "@connectrpc\/connect"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects imports between api-core feature slices', async () => {
  const root = await createFixture({
    'features/alpha/alpha.service.ts': "export const alpha = 'alpha';\n",
    'features/beta/beta.service.ts':
      "import { alpha } from '../alpha/alpha.service.js';\nvoid alpha;\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/beta\/beta\.service\.ts imports another feature.*features\/alpha/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a feature without a Public API index', async () => {
  const root = await createFixture({
    'features/alpha/alpha.service.ts': "export const alpha = 'alpha';\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/alpha is missing its Public API index\.ts/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects transport dependencies from a root feature service', async () => {
  const root = await createFixture({
    'features/alpha/index.ts': "export { alpha } from './alpha.service.js';\n",
    'features/alpha/alpha.service.ts':
      "import { ConnectError } from '@connectrpc/connect';\nexport const alpha = new ConnectError('alpha');\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/alpha\/alpha\.service\.ts imports forbidden runtime dependency "@connectrpc\/connect"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects runtime globals from a root feature service without imports', async () => {
  const root = await createFixture({
    'features/alpha/index.ts': "export { alpha } from './alpha.service.js';\n",
    'features/alpha/alpha.service.ts':
      "export const alpha = new Request('https://example.com');\n",
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /features\/alpha\/alpha\.service\.ts references forbidden runtime identifier "Request"/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
