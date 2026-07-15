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
assert_file_contains "$ENTRYPOINT" "date '+%s%N'"

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

cat >"$tmp/bin/categorized-failure" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
temporary_path="${POSTGRES_BACKUP_ERROR_CATEGORY_FILE}.tmp"
jq -n --arg errorCategory "$1" '{errorCategory:$errorCategory}' >"$temporary_path"
chmod 0600 "$temporary_path"
mv -f -- "$temporary_path" "$POSTGRES_BACKUP_ERROR_CATEGORY_FILE"
exit 43
EOF

cat >"$tmp/bin/crash-command" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$$" >"$1"
printf '%s\n' "$2"
exec sleep 60
EOF

cat >"$tmp/bin/pause-before-outcome" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$$" >"$BEFORE_OUTCOME_PID_FILE"
printf 'started\n' >"$BEFORE_OUTCOME_STARTED_FILE"
while [ ! -e "$BEFORE_OUTCOME_RELEASE_FILE" ]; do
  sleep 0.05
done
EOF

cat >"$tmp/bin/fake-sleep" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$1" >>"$JITTER_LOG"
EOF

cat >"$tmp/bin/fixed-date" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  '+%s') printf '%s\n' "$FIXED_EPOCH_SECONDS" ;;
  '-u +%Y-%m-%dT%H:%M:%SZ') printf '2026-07-15T00:00:00Z\n' ;;
  *) exec date "$@" ;;
esac
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

cat >"$tmp/bin/disappearing-stat" <<'EOF'
#!/usr/bin/env bash
target=${*: -1}
rm -f -- "$target"
exit 1
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

cat >"$tmp/bin/lifecycle-monthly-cleanup" <<'EOF'
#!/usr/bin/env bash
printf 'monthly-cleanup\n' >>"$LIFECYCLE_LOG"
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
jq -e '.job == "incremental" and .status == "success"' \
  "$tmp/state/incremental.last-outcome.json" >/dev/null || \
  fail 'successful job did not publish the current health outcome'
printf 'ok - successful job state is structured and atomic\n'

set +e
"$RUN_JOB" verify "$tmp/bin/fail-command" >/dev/null 2>&1
status=$?
set -e
assert_eq "$status" 42
assert_json_status "$tmp/state/verify.last-failure.json" verify failure
assert_eq "$(jq -r '.errorCategory' "$tmp/state/verify.last-failure.json")" command_failed
printf 'ok - command failure exit code is preserved\n'

set +e
"$RUN_JOB" monthly "$tmp/bin/categorized-failure" r2_preflight_failed \
  >/dev/null 2>&1
categorized_status=$?
set -e
assert_eq "$categorized_status" 43
assert_eq "$(jq -r '.errorCategory' "$tmp/state/monthly.last-failure.json")" \
  r2_preflight_failed
[ ! -e "$tmp/state/monthly.command-error-category.json" ] || \
  fail 'scheduled wrapper retained the child error-category handoff file'
printf 'ok - scheduled jobs preserve stable child failure categories\n'

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

rm -f "$tmp/state/check.last-failure.json" "$tmp/state/check.last-outcome.json"
set +e
BACKUP_AFTER_OUTCOME_HOOK=/bin/false \
  "$RUN_JOB" check "$tmp/bin/fail-command" >/dev/null 2>&1
publication_status=$?
set -e
[ "$publication_status" -ne 0 ] || fail 'simulated mid-publication interruption must stop'
jq -e '.status == "failure"' "$tmp/state/check.last-outcome.json" >/dev/null || \
  fail 'failure outcome was not crash-safe before derived state publication'
[ ! -e "$tmp/state/check.last-failure.json" ] || \
  fail 'simulated interruption happened after the derived failure state'
"$RUN_JOB" check true >/dev/null
jq -e '.status == "success"' "$tmp/state/check.last-outcome.json" >/dev/null || \
  fail 'later success did not replace the crash-safe failure outcome'
printf 'ok - current outcome is published before derived status state\n'

rm -f "$tmp/state/check.last-failure.json" \
  "$tmp/state/check.last-outcome.json" \
  "$tmp/state/check.running.json"
export BEFORE_OUTCOME_PID_FILE="$tmp/before-outcome-pid"
export BEFORE_OUTCOME_STARTED_FILE="$tmp/before-outcome-started"
export BEFORE_OUTCOME_RELEASE_FILE="$tmp/before-outcome-release"
BACKUP_BEFORE_OUTCOME_HOOK="$tmp/bin/pause-before-outcome" \
  "$RUN_JOB" check true >/dev/null 2>&1 &
pre_outcome_runner_pid=$!
children+=("$pre_outcome_runner_pid")
wait_for_file "$BEFORE_OUTCOME_STARTED_FILE"
wait_for_file "$tmp/state/check.running.json"
[ ! -e "$tmp/state/check.last-outcome.json" ] || \
  fail 'terminal outcome was published before the pre-outcome crash seam'
pre_outcome_hook_pid=$(cat "$BEFORE_OUTCOME_PID_FILE")
kill -9 "$pre_outcome_hook_pid" "$pre_outcome_runner_pid" 2>/dev/null || true
wait "$pre_outcome_runner_pid" 2>/dev/null || true
children=()
sleep 0.1
[ -e "$tmp/state/check.running.json" ] || \
  fail 'SIGKILL before outcome publication lost the running attempt marker'
[ ! -e "$tmp/state/check.last-outcome.json" ] || \
  fail 'SIGKILL before outcome publication unexpectedly wrote an outcome'
set +e
BACKUP_RUN_JOB_BIN=/bin/false "$RECONCILE" --preflight-complete >/dev/null
set -e
jq -e '.status == "failure" and .errorCategory == "interrupted"' \
  "$tmp/state/check.last-outcome.json" >/dev/null || \
  fail 'startup reconciliation did not recover the pre-outcome crash'
printf 'ok - pre-outcome SIGKILL preserves a recoverable running marker\n'

for signal_spec in TERM:143:check INT:130:verify HUP:129:pitr-drill; do
  signal_name=${signal_spec%%:*}
  signal_tail=${signal_spec#*:}
  expected_status=${signal_tail%%:*}
  signal_job=${signal_tail##*:}
  signal_child_file="$tmp/$signal_job-signal-child"
  rm -f "$signal_child_file" \
    "$tmp/state/$signal_job.running.json" \
    "$tmp/state/$signal_job.last-outcome.json" \
    "$tmp/state/$signal_job.last-failure.json"
  set +e
  timeout --preserve-status --signal="$signal_name" --kill-after=3s 1s \
    env --default-signal="$signal_name" "$RUN_JOB" "$signal_job" \
    "$tmp/bin/crash-command" "$signal_child_file" signal-test >/dev/null 2>&1
  signal_status=$?
  set -e
  wait_for_file "$signal_child_file"
  signal_child_pid=$(cat "$signal_child_file")
  assert_eq "$signal_status" "$expected_status"
  if kill -0 "$signal_child_pid" 2>/dev/null; then
    fail "$signal_name left the backup command child alive"
  fi
  [ ! -e "$tmp/state/$signal_job.running.json" ] || \
    fail "$signal_name left the running marker after terminal outcome publication"
  jq -e '.status == "failure" and .errorCategory == "interrupted"' \
    "$tmp/state/$signal_job.last-outcome.json" >/dev/null || \
    fail "$signal_name did not publish an interrupted terminal outcome"
done
printf 'ok - TERM INT and HUP forward to command groups and publish interruption\n'

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
if "$HEALTH" >/dev/null; then
  fail 'archiver failure-count increase must survive the second Compose health retry'
fi
"$HEALTH"
assert_eq "$(jq -r '.failedCount' "$tmp/state/archiver-failed-count.baseline.json")" 1
export FAKE_ARCHIVER_FAILED_COUNT=0
"$HEALTH"
printf 'ok - archiver increase fails two probes before bounded acknowledgement\n'

touch -d '10 minutes ago' "$tmp/wal/000000010000000000000002.ready"
BACKUP_STAT_BIN="$tmp/bin/disappearing-stat" "$HEALTH"
jq -e '.status == "healthy"' "$tmp/state/health.json" >/dev/null || \
  fail 'a disappearing WAL ready file prevented atomic healthy state output'
printf 'ok - disappearing WAL ready file is an expected race\n'

export FAKE_DISK_PERCENT=85
if "$HEALTH" >/dev/null; then fail 'disk usage at the high-water mark must be unhealthy'; fi
jq -e '.reasons | index("disk_high_water")' "$tmp/state/health.json" >/dev/null || \
  fail 'disk high-water reason missing'
export FAKE_DISK_PERCENT=10
for invalid_high_water in 0 101; do
  if BACKUP_DISK_HIGH_WATER_PERCENT="$invalid_high_water" \
    "$HEALTH" >/dev/null 2>&1; then
    fail "disk high-water accepted invalid percentage: $invalid_high_water"
  fi
done
printf 'ok - disk high-water accepts only integer percentages 1 through 100\n'

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
export FIXED_EPOCH_SECONDS="$now"
BACKUP_DATE_BIN="$tmp/bin/fixed-date" "$RUN_JOB" full true >/dev/null
same_second_started="$tmp/same-second-holder-started"
same_second_release="$tmp/same-second-holder-release"
BACKUP_DATE_BIN="$tmp/bin/fixed-date" "$RUN_JOB" incremental \
  "$tmp/bin/wait-command" "$same_second_started" "$same_second_release" &
same_second_holder_pid=$!
children+=("$same_second_holder_pid")
wait_for_file "$same_second_started"
set +e
BACKUP_DATE_BIN="$tmp/bin/fixed-date" BACKUP_PRIORITY_LOCK_WAIT_SECONDS=1 \
  "$RUN_JOB" full true >/dev/null 2>&1
same_second_timeout_status=$?
set -e
assert_eq "$same_second_timeout_status" 75
assert_eq \
  "$(jq -r '.finishedEpochSeconds' "$tmp/state/full.last-success.json")" \
  "$(jq -r '.finishedEpochSeconds' "$tmp/state/full.last-failure.json")"
if "$HEALTH" >/dev/null; then
  fail 'same-second priority timeout was incorrectly considered healthy'
fi
jq -e '.status == "failure"' "$tmp/state/full.last-outcome.json" >/dev/null || \
  fail 'same-second failure did not replace the current outcome'
touch "$same_second_release"
wait "$same_second_holder_pid"
children=()
: >"$OPERATIONS_LOG"
"$RECONCILE"
grep -Fq '<--type=full>' "$OPERATIONS_LOG" || \
  fail 'same-second priority timeout was not startup-reconciliable'
jq -e '.status == "success"' "$tmp/state/full.last-outcome.json" >/dev/null || \
  fail 'later success did not clear the current failure outcome'
"$HEALTH"

set +e
BACKUP_DATE_BIN="$tmp/bin/fixed-date" "$RUN_JOB" incremental \
  "$tmp/bin/fail-command" >/dev/null 2>&1
set -e
skip_holder_started="$tmp/skip-holder-started"
skip_holder_release="$tmp/skip-holder-release"
"$RUN_JOB" full "$tmp/bin/wait-command" "$skip_holder_started" "$skip_holder_release" &
skip_holder_pid=$!
children+=("$skip_holder_pid")
wait_for_file "$skip_holder_started"
set +e
BACKUP_DATE_BIN="$tmp/bin/fixed-date" "$RUN_JOB" incremental true >/dev/null 2>&1
skip_status=$?
set -e
assert_eq "$skip_status" 75
jq -e '.status == "failure"' "$tmp/state/incremental.last-outcome.json" >/dev/null || \
  fail 'skipped incremental erased a current failure outcome'
touch "$skip_holder_release"
wait "$skip_holder_pid"
children=()
BACKUP_DATE_BIN="$tmp/bin/fixed-date" "$RUN_JOB" incremental true >/dev/null
skip_holder_started="$tmp/skip-success-holder-started"
skip_holder_release="$tmp/skip-success-holder-release"
"$RUN_JOB" full "$tmp/bin/wait-command" "$skip_holder_started" "$skip_holder_release" &
skip_holder_pid=$!
children+=("$skip_holder_pid")
wait_for_file "$skip_holder_started"
set +e
BACKUP_DATE_BIN="$tmp/bin/fixed-date" "$RUN_JOB" incremental true >/dev/null 2>&1
skip_status=$?
set -e
assert_eq "$skip_status" 75
jq -e '.status == "success"' "$tmp/state/incremental.last-outcome.json" >/dev/null || \
  fail 'skipped incremental erased a current success outcome'
touch "$skip_holder_release"
wait "$skip_holder_pid"
children=()
printf 'ok - same-second ordering and skipped outcome semantics\n'

write_fresh_health_state
live_started="$tmp/live-holder-started"
live_release="$tmp/live-holder-release"
"$RUN_JOB" full "$tmp/bin/wait-command" "$live_started" "$live_release" &
live_runner_pid=$!
children+=("$live_runner_pid")
wait_for_file "$live_started"
set +e
BACKUP_RUN_JOB_BIN=/bin/false "$RECONCILE" >/dev/null 2>&1
set -e
[ -e "$tmp/state/full.running.json" ] || \
  fail 'startup reconciliation removed a running state while its lock was live'
touch "$live_release"
wait "$live_runner_pid"
children=()

write_fresh_health_state
crash_pid_file="$tmp/crash-child-pid"
crash_secret='crash-output-must-not-persist'
"$RUN_JOB" full "$tmp/bin/crash-command" "$crash_pid_file" "$crash_secret" &
crashed_runner_pid=$!
children+=("$crashed_runner_pid")
wait_for_file "$crash_pid_file"
crashed_child_pid=$(cat "$crash_pid_file")
kill -9 "$crashed_child_pid" "$crashed_runner_pid" 2>/dev/null || true
wait "$crashed_runner_pid" 2>/dev/null || true
children=()
printf '%s\n' "$crash_secret" >"$tmp/state/full.command-output.tmp.legacy"
set +e
BACKUP_RUN_JOB_BIN=/bin/false "$RECONCILE" >/dev/null 2>&1
set -e
[ ! -e "$tmp/state/full.running.json" ] || \
  fail 'startup reconciliation did not remove an orphaned running state'
jq -e '.status == "failure" and .errorCategory == "interrupted"' \
  "$tmp/state/full.last-outcome.json" >/dev/null || \
  fail 'orphaned running state was not converted to an interrupted outcome'
if grep -R -Fq "$crash_secret" "$tmp/state"; then
  fail 'hard-crashed or legacy command output persisted secrets on the state volume'
fi
printf 'ok - orphan cleanup requires an unheld global lock and persists no raw output\n'

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
export BACKUP_PG_ISREADY_BIN="$tmp/bin/pg-isready"
export BACKUP_ENSURE_REPLICATION_ROLE_BIN="$tmp/bin/ensure-role"
export BACKUP_PGBACKREST_BIN="$tmp/bin/lifecycle-pgbackrest"
export BACKUP_MONTHLY_ORPHAN_CLEANUP_BIN="$tmp/bin/lifecycle-monthly-cleanup"
export BACKUP_RECONCILE_BIN="$tmp/bin/lifecycle-reconcile"
export BACKUP_CROND_BIN="$tmp/bin/crond"
export POSTGRES_READY_POLL_SECONDS=0
: >"$LIFECYCLE_LOG"
"$ENTRYPOINT" --prepare-only
assert_eq "$(paste -sd, "$LIFECYCLE_LOG")" \
  'monthly-cleanup,pg_isready,pg_isready,ensure-role,pgbackrest:stanza-create,pgbackrest:check,reconcile:--preflight-complete'
[ -s "$tmp/pgbackrest.conf" ] || fail 'backup entrypoint did not render pgBackRest config'
printf 'ok - backup entrypoint lifecycle\n'

set +e
: >"$LIFECYCLE_LOG"
started_wait_ns=$(date +%s%N)
POSTGRES_READY_WAIT_SECONDS=1 POSTGRES_READY_POLL_SECONDS=2 \
BACKUP_PG_ISREADY_BIN="$tmp/bin/pg-isready-never" \
  "$ENTRYPOINT" --prepare-only >/dev/null 2>&1
ready_status=$?
finished_wait_ns=$(date +%s%N)
set -e
[ "$ready_status" -ne 0 ] || fail 'backup entrypoint must fail after its readiness deadline'
assert_eq "$(head -n 1 "$LIFECYCLE_LOG")" monthly-cleanup
elapsed_wait_ns=$((finished_wait_ns - started_wait_ns))
[ "$elapsed_wait_ns" -le 1500000000 ] || \
  fail 'readiness timeout was calculated from loop count instead of elapsed seconds'

set +e
invalid_poll_output=$(POSTGRES_READY_POLL_SECONDS=invalid "$ENTRYPOINT" --prepare-only 2>&1)
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
