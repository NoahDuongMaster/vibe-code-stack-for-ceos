#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

RUN_JOB="$ROOT/infra/docker/postgres/scripts/run-backup-job.sh"
HEALTH="$ROOT/infra/docker/postgres/scripts/backup-health.sh"
RECONCILE="$ROOT/infra/docker/postgres/scripts/reconcile-backups.sh"
ENTRYPOINT="$ROOT/infra/docker/postgres/scripts/backup-entrypoint.sh"

for script in "$RUN_JOB" "$HEALTH" "$RECONCILE" "$ENTRYPOINT"; do
  [ -x "$script" ] || fail "required executable is missing: $script"
done

# macOS does not ship flock. Re-run this behavior test in the pinned image so
# the same util-linux implementation used in production owns the lock checks.
if ! command -v flock >/dev/null 2>&1; then
  [ "${POSTGRES_BACKUP_LOCK_TEST_CONTAINER:-}" != 1 ] || \
    fail 'flock is missing from the PostgreSQL backup image'
  image=${POSTGRES_BACKUP_TEST_IMAGE:-vibe-postgres:backup-test}
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker build --quiet --file "$ROOT/infra/docker/postgres.Dockerfile" \
      --tag "$image" "$ROOT" >/dev/null
  fi
  exec docker run --rm \
    --entrypoint /bin/bash \
    --env POSTGRES_BACKUP_LOCK_TEST_CONTAINER=1 \
    --mount "type=bind,source=$ROOT,target=/workspace,readonly" \
    --workdir /workspace \
    "$image" /workspace/infra/docker/postgres/tests/job-health.test.sh
fi

tmp=$(mktemp -d)
children=()
cleanup() {
  local pid
  for pid in "${children[@]:-}"; do
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  done
  rm -rf -- "$tmp"
}
trap cleanup EXIT

mkdir -p "$tmp/bin" "$tmp/state" "$tmp/wal" "$tmp/data" "$tmp/spool" "$tmp/stage"

cat >"$tmp/bin/wait-command" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
started=$1
release=$2
printf 'started\n' >"$started"
while [ ! -e "$release" ]; do
  sleep 0.05
done
EOF

cat >"$tmp/bin/record-command" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'executed\n' >"$1"
EOF

cat >"$tmp/bin/fail-command" <<'EOF'
#!/usr/bin/env bash
printf 'safe failure\n' >&2
exit 42
EOF

cat >"$tmp/bin/secret-failure" <<'EOF'
#!/usr/bin/env bash
printf 'command failed\n' >&2
exit 41
EOF

cat >"$tmp/bin/fake-sleep" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$1" >>"$JITTER_LOG"
EOF

cat >"$tmp/bin/psql" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "${FAKE_ARCHIVER_FAILED_COUNT:-0}"
EOF

cat >"$tmp/bin/df" <<'EOF'
#!/usr/bin/env bash
path=${*: -1}
cat <<OUTPUT
Filesystem 1024-blocks Used Available Capacity Mounted on
fake 100 10 90 ${FAKE_DISK_PERCENT:-10}% $path
OUTPUT
EOF

cat >"$tmp/bin/pgbackrest" <<'EOF'
#!/usr/bin/env bash
printf 'pgbackrest' >>"$OPERATIONS_LOG"
printf ' <%s>' "$@" >>"$OPERATIONS_LOG"
printf '\n' >>"$OPERATIONS_LOG"
EOF

cat >"$tmp/bin/pg-isready" <<'EOF'
#!/usr/bin/env bash
count=0
[ ! -f "$PG_ISREADY_COUNT" ] || count=$(cat "$PG_ISREADY_COUNT")
count=$((count + 1))
printf '%s' "$count" >"$PG_ISREADY_COUNT"
printf 'pg_isready\n' >>"$LIFECYCLE_LOG"
[ "$count" -ge 2 ]
EOF

cat >"$tmp/bin/pg-isready-never" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF

cat >"$tmp/bin/ensure-role" <<'EOF'
#!/usr/bin/env bash
printf 'ensure-role\n' >>"$LIFECYCLE_LOG"
EOF

cat >"$tmp/bin/lifecycle-pgbackrest" <<'EOF'
#!/usr/bin/env bash
printf 'pgbackrest:%s\n' "${*: -1}" >>"$LIFECYCLE_LOG"
EOF

cat >"$tmp/bin/lifecycle-reconcile" <<'EOF'
#!/usr/bin/env bash
printf 'reconcile:%s\n' "$*" >>"$LIFECYCLE_LOG"
EOF

cat >"$tmp/bin/crond" <<'EOF'
#!/usr/bin/env bash
printf 'crond:%s\n' "$*" >>"$LIFECYCLE_LOG"
EOF

chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH"
export POSTGRES_BACKUP_STATE_DIR="$tmp/state"
export BACKUP_JITTER_MAX_SECONDS=0
export BACKUP_PRIORITY_LOCK_WAIT_SECONDS=3

wait_for_file() {
  local path=$1
  local attempts=200
  while [ ! -e "$path" ] && [ "$attempts" -gt 0 ]; do
    sleep 0.02
    attempts=$((attempts - 1))
  done
  [ -e "$path" ] || fail "timed out waiting for $path"
}

assert_json_status() {
  local path=$1
  local job=$2
  local status=$3
  jq -e --arg job "$job" --arg status "$status" \
    '.job == $job and .status == $status and
     (.startedAt | type == "string") and (.finishedAt | type == "string") and
     (.startedEpochSeconds | type == "number") and
     (.finishedEpochSeconds | type == "number") and
     (.durationSeconds | type == "number") and
     (.errorCategory | type == "string")' "$path" >/dev/null || \
    fail "invalid job state: $path"
  assert_file_mode "$path" 600
}

"$RUN_JOB" incremental true
assert_json_status "$tmp/state/incremental.last-success.json" incremental success
printf 'ok - successful job state is structured and atomic\n'

set +e
"$RUN_JOB" verify "$tmp/bin/fail-command" >/dev/null 2>&1
status=$?
set -e
assert_eq "$status" 42
assert_json_status "$tmp/state/verify.last-failure.json" verify failure
assert_eq "$(jq -r '.errorCategory' "$tmp/state/verify.last-failure.json")" command_failed
printf 'ok - command failure exit code is preserved\n'

secret='do-not-log-this-secret'
set +e
output=$("$RUN_JOB" check "$tmp/bin/secret-failure" "$secret" 2>&1)
status=$?
set -e
assert_eq "$status" 41
if printf '%s' "$output" | grep -Fq "$secret" || \
  grep -R -Fq "$secret" "$tmp/state"; then
  fail 'job command arguments leaked into logs or state'
fi
printf '%s\n' "$output" | jq -e \
  'select(.event == "backup_job_finished") | .level == "error"' >/dev/null || \
  fail 'failed backup job did not emit a structured error log'
printf 'ok - command arguments are excluded from logs and state\n'

unset BACKUP_JITTER_MAX_SECONDS
export POSTGRES_BACKUP_SCHEDULED_RUN=true
export JITTER_LOG="$tmp/jitter.log"
export BACKUP_SLEEP_BIN="$tmp/bin/fake-sleep"
"$RUN_JOB" incremental true >/dev/null
jitter=$(tail -n 1 "$JITTER_LOG")
[ "$jitter" -ge 0 ] && [ "$jitter" -le 300 ] || fail 'scheduled jitter is outside 0..300 seconds'
unset POSTGRES_BACKUP_SCHEDULED_RUN
: >"$JITTER_LOG"
"$RUN_JOB" incremental true >/dev/null
[ ! -s "$JITTER_LOG" ] || fail 'manual jobs must default to zero jitter'
export BACKUP_JITTER_MAX_SECONDS=0
printf 'ok - scheduled and manual jitter defaults\n'

rm -f "$tmp/state/"*.json
full_started="$tmp/full-started"
full_release="$tmp/full-release"
"$RUN_JOB" full "$tmp/bin/wait-command" "$full_started" "$full_release" &
holder_pid=$!
children+=("$holder_pid")
wait_for_file "$full_started"
set +e
"$RUN_JOB" incremental true >/dev/null 2>&1
status=$?
set -e
assert_eq "$status" 75
assert_json_status "$tmp/state/incremental.last-skipped.json" incremental skipped
[ ! -e "$tmp/state/incremental.last-failure.json" ] || \
  fail 'incremental contention recorded a failure'
[ -e "$tmp/state/full.running.json" ] || fail 'contending incremental changed the full running state'
touch "$full_release"
wait "$holder_pid"
children=()
assert_json_status "$tmp/state/full.last-success.json" full success
printf 'ok - incremental lock contention is skipped\n'

for priority_job in full differential monthly check verify pitr-drill monthly-drill; do
  rm -f "$tmp/state/"*.running.json
  started="$tmp/${priority_job}-holder-started"
  release="$tmp/${priority_job}-holder-release"
  executed="$tmp/${priority_job}-executed"
  "$RUN_JOB" incremental "$tmp/bin/wait-command" "$started" "$release" &
  holder_pid=$!
  children+=("$holder_pid")
  wait_for_file "$started"
  "$RUN_JOB" "$priority_job" "$tmp/bin/record-command" "$executed" &
  priority_pid=$!
  children+=("$priority_pid")
  sleep 0.15
  [ ! -e "$executed" ] || fail "$priority_job did not wait for the lock"
  touch "$release"
  wait "$holder_pid"
  wait "$priority_pid"
  children=()
  [ -e "$executed" ] || fail "$priority_job never executed after lock release"
  assert_json_status "$tmp/state/$priority_job.last-success.json" "$priority_job" success
done
printf 'ok - every priority job waits and executes after lock release\n'

timeout_started="$tmp/timeout-holder-started"
timeout_release="$tmp/timeout-holder-release"
"$RUN_JOB" incremental "$tmp/bin/wait-command" "$timeout_started" "$timeout_release" &
holder_pid=$!
children+=("$holder_pid")
wait_for_file "$timeout_started"
set +e
BACKUP_PRIORITY_LOCK_WAIT_SECONDS=1 "$RUN_JOB" full true >/dev/null 2>&1
status=$?
set -e
[ "$status" -ne 0 ] || fail 'priority lock timeout must fail'
assert_json_status "$tmp/state/full.last-failure.json" full failure
assert_eq "$(jq -r '.errorCategory' "$tmp/state/full.last-failure.json")" lock_timeout
touch "$timeout_release"
wait "$holder_pid"
children=()
printf 'ok - priority lock timeout is a failure\n'

rm -f "$tmp/state/"*.json
now=$(date +%s)
write_job_state() {
  local job=$1
  local outcome=$2
  local age=$3
  local epoch=$((now - age))
  jq -n --arg job "$job" --arg status "$outcome" --argjson epoch "$epoch" \
    '{job:$job,status:$status,startedAt:"2026-01-01T00:00:00Z",
      finishedAt:"2026-01-01T00:00:01Z",startedEpochSeconds:$epoch,
      finishedEpochSeconds:$epoch,durationSeconds:1,errorCategory:"none"}' \
    >"$tmp/state/$job.last-$outcome.json"
  chmod 0600 "$tmp/state/$job.last-$outcome.json"
}

write_fresh_health_state() {
  rm -f "$tmp/state/"*.json
  write_job_state incremental success 60
  write_job_state differential success 60
  write_job_state full success 60
  write_job_state monthly success 60
  write_job_state check success 60
  write_job_state verify success 60
  write_job_state pitr-drill success 60
  write_job_state monthly-drill success 60
}

export POSTGRES_WAL_ARCHIVE_STATUS_DIR="$tmp/wal"
export POSTGRES_DATA_DIR="$tmp/data"
export POSTGRES_BACKUP_SPOOL_DIR="$tmp/spool"
export POSTGRES_BACKUP_STAGE_DIR="$tmp/stage"
export BACKUP_PSQL_BIN="$tmp/bin/psql"
export BACKUP_DF_BIN="$tmp/bin/df"
export FAKE_ARCHIVER_FAILED_COUNT=0
export FAKE_DISK_PERCENT=10

write_fresh_health_state
"$HEALTH"
jq -e '.status == "healthy" and (.reasons | length == 0)' "$tmp/state/health.json" >/dev/null || \
  fail 'fresh backup state must be healthy'
assert_file_mode "$tmp/state/health.json" 600
[ -e "$tmp/state/archiver-failed-count.baseline.json" ] || fail 'healthy archiver baseline missing'
printf 'ok - fresh backup health\n'

write_job_state incremental success 10800
write_job_state differential success 10800
write_job_state full success 10800
if "$HEALTH" >/dev/null; then fail 'stale physical backup must be unhealthy'; fi
jq -e '.status == "unhealthy" and (.reasons | index("incremental_stale"))' \
  "$tmp/state/health.json" >/dev/null || fail 'physical age reason missing'

jq -n --argjson started "$now" \
  '{job:"full",status:"running",startedAt:"2026-01-01T00:00:00Z",startedEpochSeconds:$started}' \
  >"$tmp/state/full.running.json"
"$HEALTH"
write_job_state full failure 1
if "$HEALTH" >/dev/null; then fail 'running physical job must not suppress a prior failure'; fi
jq -e '.reasons | index("full_last_attempt_failed")' "$tmp/state/health.json" >/dev/null || \
  fail 'running physical job suppressed a prior failure reason'
rm -f "$tmp/state/full.last-failure.json"
touch -d '10 minutes ago' "$tmp/wal/000000010000000000000001.ready"
if "$HEALTH" >/dev/null; then fail 'running physical job must not suppress stalled WAL'; fi
jq -e '.reasons | index("wal_archive_stalled")' "$tmp/state/health.json" >/dev/null || \
  fail 'stalled WAL reason missing'
rm -f "$tmp/wal/"*.ready "$tmp/state/full.running.json"
write_job_state incremental success 60
write_job_state differential success 60
write_job_state full success 60
printf 'ok - running physical job suppresses only physical age\n'

write_job_state full failure 1
if "$HEALTH" >/dev/null; then fail 'a newer prior failure must remain unhealthy'; fi
jq -e '.reasons | index("full_last_attempt_failed")' "$tmp/state/health.json" >/dev/null || \
  fail 'prior failure reason missing'
rm -f "$tmp/state/full.last-failure.json"

export FAKE_ARCHIVER_FAILED_COUNT=1
if "$HEALTH" >/dev/null; then fail 'increased pg_stat_archiver failed_count must be unhealthy'; fi
jq -e '.reasons | index("archiver_failed_count_increased")' "$tmp/state/health.json" >/dev/null || \
  fail 'archiver failure-count reason missing'
export FAKE_ARCHIVER_FAILED_COUNT=0
rm -f "$tmp/state/archiver-failed-count.baseline.json"
"$HEALTH"
printf 'ok - archiver baseline detects increases without checking idle archive time\n'

export FAKE_DISK_PERCENT=85
if "$HEALTH" >/dev/null; then fail 'disk usage at the high-water mark must be unhealthy'; fi
jq -e '.reasons | index("disk_high_water")' "$tmp/state/health.json" >/dev/null || \
  fail 'disk high-water reason missing'
export FAKE_DISK_PERCENT=10

write_job_state differential success 93601
if "$HEALTH" >/dev/null; then fail 'stale differential must be unhealthy'; fi
jq -e '.reasons | index("differential_stale")' "$tmp/state/health.json" >/dev/null || fail 'differential reason missing'
write_job_state differential success 60
write_job_state full success 691201
if "$HEALTH" >/dev/null; then fail 'stale full must be unhealthy'; fi
write_job_state full success 60
write_job_state monthly success 3024001
if "$HEALTH" >/dev/null; then fail 'stale monthly archive must be unhealthy'; fi
write_job_state monthly success 60
write_job_state pitr-drill success 691201
if "$HEALTH" >/dev/null; then fail 'stale PITR drill must be unhealthy'; fi
write_job_state pitr-drill success 60
write_job_state monthly-drill success 3024001
if "$HEALTH" >/dev/null; then fail 'stale monthly drill must be unhealthy'; fi
write_job_state monthly-drill success 60
"$HEALTH"
printf 'ok - exact backup and drill age thresholds\n'

export OPERATIONS_LOG="$tmp/operations.log"

write_fresh_health_state
actual_timeout_started="$tmp/actual-timeout-holder-started"
actual_timeout_release="$tmp/actual-timeout-holder-release"
"$RUN_JOB" incremental \
  "$tmp/bin/wait-command" "$actual_timeout_started" "$actual_timeout_release" &
holder_pid=$!
children+=("$holder_pid")
wait_for_file "$actual_timeout_started"
set +e
BACKUP_PRIORITY_LOCK_WAIT_SECONDS=1 "$RUN_JOB" full true >/dev/null 2>&1
actual_timeout_status=$?
set -e
[ "$actual_timeout_status" -ne 0 ] || fail 'actual priority timeout must fail'
touch "$actual_timeout_release"
wait "$holder_pid"
children=()
if "$HEALTH" >/dev/null; then fail 'actual priority timeout must make health unhealthy'; fi
jq -e '.reasons | index("full_last_attempt_failed")' "$tmp/state/health.json" >/dev/null || \
  fail 'actual priority timeout did not affect health'
: >"$OPERATIONS_LOG"
"$RECONCILE"
grep -Fq '<--type=full>' "$OPERATIONS_LOG" || \
  fail 'actual priority timeout was not eligible for startup reconciliation'
printf 'ok - actual priority timeout is unhealthy and reconciliable\n'

test_reconcile_job() {
  local missing_job=$1
  local expected_pattern=$2
  write_fresh_health_state
  rm -f "$tmp/state/$missing_job.last-success.json"
  : >"$OPERATIONS_LOG"
  "$RECONCILE"
  grep -Fq "$expected_pattern" "$OPERATIONS_LOG" || \
    fail "reconciliation did not run $missing_job"
  assert_json_status "$tmp/state/$missing_job.last-success.json" "$missing_job" success
}

test_reconcile_job full '<--type=full>'
test_reconcile_job differential '<--type=diff>'
test_reconcile_job incremental '<--type=incr>'
test_reconcile_job check '<check>'

write_fresh_health_state
write_job_state full failure 1
: >"$OPERATIONS_LOG"
"$RECONCILE"
grep -Fq '<--type=full>' "$OPERATIONS_LOG" || \
  fail 'a newer full failure was not eligible for startup reconciliation'

rm -f "$tmp/state/"*.last-success.json "$tmp/state/"*.last-failure.json
: >"$OPERATIONS_LOG"
"$RECONCILE"
grep -Fq '<--type=full>' "$OPERATIONS_LOG" || fail 'missing full was not reconciled first'
if grep -Eq -- '--type=(diff|incr)' "$OPERATIONS_LOG"; then
  fail 'startup reconciliation ran more than one overdue backup job'
fi
printf 'ok - startup reconciliation priority and one-job limit\n'

export LIFECYCLE_LOG="$tmp/lifecycle.log"
export PG_ISREADY_COUNT="$tmp/pg-isready-count"
export POSTGRES_BACKUP_MODE=enabled
export POSTGRES_BACKUP_REPOSITORY_TYPE=posix
export POSTGRES_USER=trading_rpc POSTGRES_DB=trading_rpc
export POSTGRES_BACKUP_CONFIG_PATH="$tmp/pgbackrest.conf"
export POSTGRES_BACKUP_CRONTAB_DIR="$ROOT/infra/docker/postgres/config"
export POSTGRES_BACKUP_CRONTAB_FILE=backup-schedule.cron
export BACKUP_PG_ISREADY_BIN="$tmp/bin/pg-isready"
export BACKUP_ENSURE_REPLICATION_ROLE_BIN="$tmp/bin/ensure-role"
export BACKUP_PGBACKREST_BIN="$tmp/bin/lifecycle-pgbackrest"
export BACKUP_RECONCILE_BIN="$tmp/bin/lifecycle-reconcile"
export BACKUP_CROND_BIN="$tmp/bin/crond"
export POSTGRES_READY_POLL_SECONDS=0
: >"$LIFECYCLE_LOG"
"$ENTRYPOINT"
assert_eq "$(paste -sd, "$LIFECYCLE_LOG")" \
  'pg_isready,pg_isready,ensure-role,pgbackrest:stanza-create,pgbackrest:check,reconcile:--preflight-complete,crond:-f -c /workspace/infra/docker/postgres/config'
[ -s "$tmp/pgbackrest.conf" ] || fail 'backup entrypoint did not render pgBackRest config'
printf 'ok - backup entrypoint lifecycle\n'

set +e
started_wait=$(date +%s)
POSTGRES_READY_WAIT_SECONDS=1 POSTGRES_READY_POLL_SECONDS=2 \
BACKUP_PG_ISREADY_BIN="$tmp/bin/pg-isready-never" \
  "$ENTRYPOINT" >/dev/null 2>&1
ready_status=$?
finished_wait=$(date +%s)
set -e
[ "$ready_status" -ne 0 ] || fail 'backup entrypoint must fail after its readiness deadline'
[ $((finished_wait - started_wait)) -lt 2 ] || \
  fail 'readiness timeout was calculated from loop count instead of elapsed seconds'

set +e
invalid_poll_output=$(POSTGRES_READY_POLL_SECONDS=invalid "$ENTRYPOINT" 2>&1)
invalid_poll_status=$?
set -e
[ "$invalid_poll_status" -ne 0 ] || fail 'invalid readiness poll seconds must fail'
printf '%s' "$invalid_poll_output" | grep -Fq \
  'POSTGRES_READY_POLL_SECONDS must be a non-negative number' || \
  fail 'invalid readiness poll seconds did not fail validation'
printf 'ok - backup readiness deadline uses validated elapsed seconds\n'

if find "$tmp/state" -name '*.tmp.*' | grep -q .; then
  fail 'atomic state writes left temporary files behind'
fi
printf 'ok - job scheduling, reconciliation, and health contracts\n'
