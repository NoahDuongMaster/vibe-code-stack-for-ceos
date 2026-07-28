import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROTOCOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedRoot = resolve(PROTOCOL_ROOT, 'src/gen');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'vibe-protocol-codegen-'));

try {
  execFileSync('buf', ['generate', '--output', temporaryRoot], {
    cwd: PROTOCOL_ROOT,
    stdio: 'inherit',
  });
  execFileSync(
    'diff',
    ['-ruN', generatedRoot, resolve(temporaryRoot, 'src/gen')],
    {
      cwd: PROTOCOL_ROOT,
      stdio: 'inherit',
    },
  );
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
