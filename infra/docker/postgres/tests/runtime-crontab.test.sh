#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

renderer="$ROOT/infra/docker/postgres/scripts/render-backup-crontab.sh"
[ -x "$renderer" ] || fail 'runtime crontab renderer is missing'

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
output="$tmp/crontabs/postgres"

"$renderer" "$output"
cmp -s "$output" "$ROOT/infra/docker/postgres/config/backup-schedule.cron" || \
  fail 'runtime default crontab differs from the checked-in UTC schedule'
assert_file_mode "$output" 600
printf 'ok - runtime crontab preserves checked-in defaults\n'

POSTGRES_BACKUP_CRON_FULL='17 1 * * 6' "$renderer" "$output"
assert_file_contains "$output" \
  '17 1 * * 6 env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh full '
assert_file_contains "$output" \
  '5 * * * * env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh incremental '
printf 'ok - one schedule can be overridden without rebuilding the image\n'

checksum_before=$(sha256sum "$output" | awk '{print $1}')
for malicious_schedule in \
  $'0 2 * * *\ntouch /tmp/injected' \
  '0 2 * * *; touch /tmp/injected' \
  '0 2 * * * extra' \
  '@daily'; do
  if POSTGRES_BACKUP_CRON_FULL="$malicious_schedule" \
    "$renderer" "$output" >/dev/null 2>&1; then
    fail 'unsafe runtime cron schedule was accepted'
  fi
  assert_eq "$(sha256sum "$output" | awk '{print $1}')" "$checksum_before"
done
if find "$(dirname -- "$output")" -name '*.tmp.*' | grep -q .; then
  fail 'crontab renderer left a temporary file after rejected input'
fi
printf 'ok - runtime crontab rejects injection without replacing last good config\n'
