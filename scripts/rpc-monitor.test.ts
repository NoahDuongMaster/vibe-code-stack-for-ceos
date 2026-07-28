import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MONITOR = resolve(
  ROOT_DIR,
  'infra/terraform/modules/rpc-stack/files/monitor.sh',
);

const writeExecutable = (path: string, contents: string): void => {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
};

const runMonitor = (containerState: 'healthy' | 'unhealthy') => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-rpc-monitor-test-'));
  const binaries = join(directory, 'bin');
  const composeDirectory = join(directory, 'compose');
  const capture = join(directory, 'metrics.json');
  mkdirSync(binaries);
  mkdirSync(composeDirectory);
  writeFileSync(join(composeDirectory, 'images.env'), 'IMAGE=test\n');
  writeFileSync(
    join(directory, 'infra.env'),
    'AWS_REGION=ap-southeast-1\nDEPLOYMENT_ENVIRONMENT=test\n',
  );
  writeFileSync(
    join(directory, 'meminfo'),
    'MemTotal: 1000 kB\nMemAvailable: 400 kB\n',
  );

  writeExecutable(
    join(binaries, 'docker'),
    `#!/bin/sh
set -eu
if [ "$1" = compose ]; then
  case " $* " in
    *" ps --quiet "*) printf 'container-id\\n' ;;
    *" exec --no-TTY "*) exit 0 ;;
    *) exit 0 ;;
  esac
elif [ "$1" = inspect ]; then
  printf 'running|${containerState}\\n'
fi
`,
  );
  writeExecutable(
    join(binaries, 'df'),
    `#!/bin/sh
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\n'
printf '/dev/mock 100 55 45 55%% /mock\\n'
`,
  );
  writeExecutable(
    join(binaries, 'aws'),
    `#!/bin/sh
set -eu
for argument in "$@"; do
  case "$argument" in
    file://*) cp "\${argument#file://}" "$MOCK_METRIC_CAPTURE" ;;
  esac
done
`,
  );

  const result = spawnSync('bash', [MONITOR], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MOCK_METRIC_CAPTURE: capture,
      PATH: `${binaries}:${process.env.PATH ?? ''}`,
      VIBE_RPC_COMPOSE_DIR: composeDirectory,
      VIBE_RPC_INFRA_ENV_FILE: join(directory, 'infra.env'),
      VIBE_RPC_PROC_MEMINFO: join(directory, 'meminfo'),
    },
  });

  const metrics = JSON.parse(readFileSync(capture, 'utf8')) as Array<{
    MetricName: string;
    Value: number;
  }>;
  rmSync(directory, { force: true, recursive: true });
  return { metrics, result };
};

test('should publish healthy operational metrics', () => {
  const { metrics, result } = runMonitor('healthy');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    Object.fromEntries(
      metrics.map(({ MetricName, Value }) => [MetricName, Value]),
    ),
    {
      BackupHealthy: 1,
      ContainersHealthy: 1,
      DiskUsedPercent: 55,
      InodeUsedPercent: 55,
      MemoryUsedPercent: 60,
    },
  );
});

test('should publish an unhealthy metric and fail when a container is unhealthy', () => {
  const { metrics, result } = runMonitor('unhealthy');
  assert.equal(result.status, 1);
  assert.equal(
    metrics.find(({ MetricName }) => MetricName === 'ContainersHealthy')?.Value,
    0,
  );
});
