#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

schedule="$ROOT/infra/docker/postgres/config/backup-schedule.cron"
assert_file_contains "$schedule" \
  '5 * * * * env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh incremental '
assert_file_contains "$schedule" \
  '0 2 * * 1-6 env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh differential '
assert_file_contains "$schedule" \
  '0 2 * * 0 env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh full '
assert_file_contains "$schedule" \
  '30 6 2 * * env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh monthly-drill '

node - "$schedule" <<'NODE'
const fs = require('node:fs');

const schedulePath = process.argv[2];
const jobs = fs
  .readFileSync(schedulePath, 'utf8')
  .split('\n')
  .filter((line) => line && !/^[A-Z_]+=/.test(line))
  .map((line) => {
    const fields = line.trim().split(/\s+/);
    const command = fields.slice(5).join(' ');
    const match = command.match(/run-backup-job\.sh\s+(\S+)/);
    if (!match) throw new Error(`Cannot identify scheduled job: ${line}`);
    return { fields: fields.slice(0, 5), name: match[1] };
  });

const fieldMatches = (expression, value, sunday = false) =>
  expression.split(',').some((part) => {
    if (part === '*') return true;
    if (part.startsWith('*/')) return value % Number(part.slice(2)) === 0;
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      return value >= start && value <= end;
    }
    const expected = Number(part);
    return value === expected || (sunday && value === 0 && expected === 7);
  });

const jobMatches = (job, date) => {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = job.fields;
  if (!fieldMatches(minute, date.getUTCMinutes())) return false;
  if (!fieldMatches(hour, date.getUTCHours())) return false;
  if (!fieldMatches(month, date.getUTCMonth() + 1)) return false;

  const domMatches = fieldMatches(dayOfMonth, date.getUTCDate());
  const dowMatches = fieldMatches(dayOfWeek, date.getUTCDay(), true);
  const domRestricted = dayOfMonth !== '*';
  const dowRestricted = dayOfWeek !== '*';
  return domRestricted && dowRestricted ? domMatches || dowMatches : domMatches && dowMatches;
};

for (let timestamp = Date.UTC(2026, 0, 1); timestamp < Date.UTC(2028, 0, 1); timestamp += 60_000) {
  const date = new Date(timestamp);
  const matching = jobs.filter((job) => jobMatches(job, date));
  if (matching.length > 1) {
    throw new Error(
      `Cron collision at ${date.toISOString()}: ${matching.map(({ name }) => name).join(', ')}`,
    );
  }
}

process.stdout.write('ok - cron schedule has no exact timestamp collisions\n');
NODE
