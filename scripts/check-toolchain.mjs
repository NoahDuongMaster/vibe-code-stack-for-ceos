import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const validateToolchain = ({
  actualNodeVersion,
  actualPnpmVersion,
  expectedNodeMajor,
  packageManager,
}) => {
  const errors = [];
  const actualNodeMajor = actualNodeVersion.replace(/^v/, '').split('.')[0];

  if (actualNodeMajor !== expectedNodeMajor) {
    errors.push(
      `Node.js major mismatch: expected ${expectedNodeMajor}, received ${actualNodeVersion}`,
    );
  }

  const pnpmDeclaration = /^pnpm@([^+]+)(?:\+.+)?$/.exec(packageManager);
  if (!pnpmDeclaration) {
    errors.push(
      `packageManager must declare pnpm@<version>, received ${packageManager}`,
    );
  } else if (actualPnpmVersion !== pnpmDeclaration[1]) {
    errors.push(
      `pnpm version mismatch: expected ${pnpmDeclaration[1]}, received ${actualPnpmVersion}`,
    );
  }

  return errors;
};

const readContract = (rootDir) => {
  const packageJson = JSON.parse(
    readFileSync(resolve(rootDir, 'package.json'), 'utf8'),
  );

  return {
    expectedNodeMajor: readFileSync(resolve(rootDir, '.nvmrc'), 'utf8').trim(),
    packageManager: packageJson.packageManager,
  };
};

const readPnpmVersion = () => {
  const result = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'pnpm --version failed');
  }
  return result.stdout.trim();
};

export const checkToolchain = (rootDir = ROOT_DIR) => {
  const active = {
    actualNodeVersion: process.version,
    actualPnpmVersion: readPnpmVersion(),
  };
  const errors = validateToolchain({ ...active, ...readContract(rootDir) });
  if (errors.length > 0) throw new Error(errors.join('\n'));

  return {
    nodeVersion: active.actualNodeVersion,
    pnpmVersion: active.actualPnpmVersion,
  };
};

const mainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;

if (import.meta.url === mainModule) {
  try {
    const active = checkToolchain();
    process.stdout.write(
      `Toolchain OK: Node.js ${active.nodeVersion}, pnpm ${active.pnpmVersion}\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
