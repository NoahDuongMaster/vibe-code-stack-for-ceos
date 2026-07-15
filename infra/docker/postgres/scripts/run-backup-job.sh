#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

readonly EX_TEMPFAIL=75
state_dir=${POSTGRES_BACKUP_STATE_DIR:-/var/lib/postgres-backup/state}
lock_path=${POSTGRES_BACKUP_LOCK_PATH:-$state_dir/backup-job.lock}
flock_bin=${BACKUP_FLOCK_BIN:-flock}
sleep_bin=${BACKUP_SLEEP_BIN:-sleep}
date_bin=${BACKUP_DATE_BIN:-date}
outcome_publish_hook=${BACKUP_AFTER_OUTCOME_HOOK:-true}
priority_lock_wait=${BACKUP_PRIORITY_LOCK_WAIT_SECONDS:-21600}

job=${1:-}
[ "$#" -ge 2 ] || {
  printf 'usage: run-backup-job.sh JOB_NAME COMMAND [ARGUMENT ...]\n' >&2
  exit 64
}
shift

case "$job" in
  incremental) lock_policy=nonblocking ;;
  full | differential | monthly | check | verify | pitr-drill | monthly-drill)
    lock_policy=priority
    ;;
  *)
    printf 'unsupported PostgreSQL backup job\n' >&2
    exit 64
    ;;
esac

case "$priority_lock_wait" in
  '' | *[!0-9]*)
    printf 'BACKUP_PRIORITY_LOCK_WAIT_SECONDS must be a non-negative integer\n' >&2
    exit 64
    ;;
esac

if [ -n "${BACKUP_JITTER_MAX_SECONDS+x}" ]; then
  jitter_max=$BACKUP_JITTER_MAX_SECONDS
elif [ "${POSTGRES_BACKUP_SCHEDULED_RUN:-false}" = true ]; then
  jitter_max=300
else
  jitter_max=0
fi
case "$jitter_max" in
  '' | *[!0-9]*)
    printf 'BACKUP_JITTER_MAX_SECONDS must be a non-negative integer\n' >&2
    exit 64
    ;;
esac

install -d -m 0700 "$state_dir"
umask 077

if [ "$jitter_max" -gt 0 ]; then
  random_value=$(od -An -N4 -tu4 /dev/urandom | tr -d '[:space:]')
  jitter_seconds=$((random_value % (jitter_max + 1)))
  "$sleep_bin" "$jitter_seconds"
fi

started_epoch=$("$date_bin" +%s)
started_at=$("$date_bin" -u '+%Y-%m-%dT%H:%M:%SZ')
running_path="$state_dir/$job.running.json"
lock_acquired=false

cleanup() {
  if [ "$lock_acquired" = true ]; then
    rm -f -- "$running_path"
  fi
}
trap cleanup EXIT

record_outcome() {
  local status=$1
  local error_category=$2
  local finished_epoch
  local finished_at
  local duration
  local output_path
  local outcome_path
  local log_level

  finished_epoch=$("$date_bin" +%s)
  finished_at=$("$date_bin" -u '+%Y-%m-%dT%H:%M:%SZ')
  duration=$((finished_epoch - started_epoch))
  output_path="$state_dir/$job.last-$status.json"
  outcome_path="$state_dir/$job.last-outcome.json"
  if [ "$status" != skipped ]; then
    atomic_write_json "$outcome_path" -n \
      --arg job "$job" \
      --arg status "$status" \
      --arg startedAt "$started_at" \
      --arg finishedAt "$finished_at" \
      --arg errorCategory "$error_category" \
      --argjson startedEpochSeconds "$started_epoch" \
      --argjson finishedEpochSeconds "$finished_epoch" \
      --argjson durationSeconds "$duration" \
      '{job:$job,status:$status,startedAt:$startedAt,finishedAt:$finishedAt,
        startedEpochSeconds:$startedEpochSeconds,
        finishedEpochSeconds:$finishedEpochSeconds,
        durationSeconds:$durationSeconds,errorCategory:$errorCategory}'
    "$outcome_publish_hook"
  fi
  atomic_write_json "$output_path" -n \
    --arg job "$job" \
    --arg status "$status" \
    --arg startedAt "$started_at" \
    --arg finishedAt "$finished_at" \
    --arg errorCategory "$error_category" \
    --argjson startedEpochSeconds "$started_epoch" \
    --argjson finishedEpochSeconds "$finished_epoch" \
    --argjson durationSeconds "$duration" \
    '{job:$job,status:$status,startedAt:$startedAt,finishedAt:$finishedAt,
      startedEpochSeconds:$startedEpochSeconds,
      finishedEpochSeconds:$finishedEpochSeconds,
      durationSeconds:$durationSeconds,errorCategory:$errorCategory}'
  case "$status" in
    failure) log_level=error ;;
    skipped) log_level=warn ;;
    *) log_level=info ;;
  esac
  json_log "$log_level" backup_job_finished "$job:$status:$error_category"
}

exec {lock_fd}>"$lock_path"
if [ "$lock_policy" = nonblocking ]; then
  if ! "$flock_bin" -n "$lock_fd"; then
    record_outcome skipped lock_contended
    exit "$EX_TEMPFAIL"
  fi
else
  if ! "$flock_bin" -w "$priority_lock_wait" "$lock_fd"; then
    record_outcome failure lock_timeout
    exit "$EX_TEMPFAIL"
  fi
fi
lock_acquired=true
lock_acquired_epoch=$("$date_bin" +%s)

atomic_write_json "$running_path" -n \
  --arg job "$job" \
  --arg status running \
  --arg startedAt "$started_at" \
  --argjson startedEpochSeconds "$started_epoch" \
  --argjson lockAcquiredEpochSeconds "$lock_acquired_epoch" \
  '{job:$job,status:$status,startedAt:$startedAt,
    startedEpochSeconds:$startedEpochSeconds,
    lockAcquiredEpochSeconds:$lockAcquiredEpochSeconds}'

set +e
"$@" >/dev/null 2>&1
command_status=$?
set -e

rm -f -- "$running_path"
lock_acquired=false
if [ "$command_status" -eq 0 ]; then
  record_outcome success none
else
  record_outcome failure command_failed
fi
exit "$command_status"
