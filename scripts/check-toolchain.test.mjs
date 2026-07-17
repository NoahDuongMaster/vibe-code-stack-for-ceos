import assert from 'node:assert/strict';
import test from 'node:test';

import { validateToolchain } from './check-toolchain.mjs';

const MATCHING_TOOLCHAIN = {
  actualNodeVersion: 'v22.18.0',
  actualPnpmVersion: '11.2.2',
  expectedNodeMajor: '22',
  packageManager: 'pnpm@11.2.2',
};

test('should accept matching Node.js and pnpm versions', () => {
  assert.deepEqual(validateToolchain(MATCHING_TOOLCHAIN), []);
});

test('should reject a Node.js major when it differs from .nvmrc', () => {
  assert.deepEqual(
    validateToolchain({
      ...MATCHING_TOOLCHAIN,
      actualNodeVersion: 'v24.12.0',
    }),
    ['Node.js major mismatch: expected 22, received v24.12.0'],
  );
});

test('should reject pnpm when it differs from packageManager', () => {
  assert.deepEqual(
    validateToolchain({
      ...MATCHING_TOOLCHAIN,
      actualPnpmVersion: '11.3.0',
    }),
    ['pnpm version mismatch: expected 11.2.2, received 11.3.0'],
  );
});

test('should reject packageManager when it does not declare pnpm', () => {
  assert.deepEqual(
    validateToolchain({
      ...MATCHING_TOOLCHAIN,
      packageManager: 'npm@11.4.2',
    }),
    ['packageManager must declare pnpm@<version>, received npm@11.4.2'],
  );
});
