#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

state_dir=${POSTGRES_BACKUP_STATE_DIR:-/var/lib/postgres-backup/state}
lock_path=${POSTGRES_BACKUP_LOCK_PATH:-$state_dir/backup-job.lock}
run_job=${BACKUP_RUN_JOB_BIN:-$SCRIPT_DIR/run-backup-job.sh}
pgbackrest_bin=${BACKUP_PGBACKREST_BIN:-pgbackrest}
flock_bin=${BACKUP_FLOCK_BIN:-flock}
config_path=${POSTGRES_BACKUP_CONFIG_PATH:-/run/postgres-backup/pgbackrest.conf}
stanza=${POSTGRES_BACKUP_STANZA:-trading-rpc}
now=$(date +%s)

if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != --preflight-complete ]; }; then
  printf 'usage: reconcile-backups.sh [--preflight-complete]\n' >&2
  exit 64
fi

install -d -m 0700 "$state_dir"

state_number() {
  local path=$1
  local expression=$2
  [ -r "$path" ] || {
    printf '0'
    return
  }
  jq -er "$expression | select(type == \"number\")" "$path" 2>/dev/null || printf '0'
}

record_interrupted_outcome() {
  local job=$1
  local running_path=$2
  local started_epoch
  local started_at
  local finished_epoch
  local finished_at
  local duration
  local output_path
  local outcome_path

  started_epoch=$(state_number "$running_path" '.startedEpochSeconds')
  started_at=$(jq -er '.startedAt | select(type == "string")' \
    "$running_path" 2>/dev/null || printf 'unknown')
  finished_epoch=$(date +%s)
  finished_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  duration=0
  if [ "$started_epoch" -gt 0 ] && [ "$finished_epoch" -ge "$started_epoch" ]; then
    duration=$((finished_epoch - started_epoch))
  fi
  output_path="$state_dir/$job.last-failure.json"
  outcome_path="$state_dir/$job.last-outcome.json"

  for target_path in "$outcome_path" "$output_path"; do
    atomic_write_json "$target_path" -n \
      --arg job "$job" \
      --arg status failure \
      --arg startedAt "$started_at" \
      --arg finishedAt "$finished_at" \
      --arg errorCategory interrupted \
      --argjson startedEpochSeconds "$started_epoch" \
      --argjson finishedEpochSeconds "$finished_epoch" \
      --argjson durationSeconds "$duration" \
      '{job:$job,status:$status,startedAt:$startedAt,finishedAt:$finishedAt,
        startedEpochSeconds:$startedEpochSeconds,
        finishedEpochSeconds:$finishedEpochSeconds,
        durationSeconds:$durationSeconds,errorCategory:$errorCategory}'
  done
  rm -f -- "$running_path"
  json_log warn backup_job_interrupted "$job:failure:interrupted"
}

cleanup_orphaned_running_states() {
  local running_path
  local job
  local -a running_paths=()

  exec {reconcile_lock_fd}>"$lock_path"
  if ! "$flock_bin" -n "$reconcile_lock_fd"; then
    exec {reconcile_lock_fd}>&-
    return 0
  fi
  find "$state_dir" -maxdepth 1 -type f \
    -name '*.command-output.tmp.*' -delete 2>/dev/null || true
  shopt -s nullglob
  running_paths=("$state_dir"/*.running.json)
  shopt -u nullglob
  for running_path in "${running_paths[@]}"; do
    job=$(basename -- "$running_path" .running.json)
    case "$job" in
      incremental | differential | full | monthly | check | verify | pitr-drill | monthly-drill)
        record_interrupted_outcome "$job" "$running_path"
        ;;
    esac
  done
  "$flock_bin" -u "$reconcile_lock_fd"
  exec {reconcile_lock_fd}>&-
}

cleanup_orphaned_running_states

if [ "${1:-}" != --preflight-complete ]; then
  "$pgbackrest_bin" --config="$config_path" --stanza="$stanza" stanza-create
  "$pgbackrest_bin" --config="$config_path" --stanza="$stanza" check
fi

job_is_overdue() {
  local job=$1
  local maximum_age=$2
  local success
  local failure
  local outcome_status

  success=$(state_number "$state_dir/$job.last-success.json" '.finishedEpochSeconds')
  failure=$(state_number "$state_dir/$job.last-failure.json" '.finishedEpochSeconds')
  outcome_status=$(jq -er '.status | select(. == "success" or . == "failure")' \
    "$state_dir/$job.last-outcome.json" 2>/dev/null || true)
  [ "$success" -gt 0 ] || return 0
  [ "$outcome_status" != failure ] || return 0
  if [ -z "$outcome_status" ] && [ "$failure" -gt 0 ] && [ "$failure" -ge "$success" ]; then
    return 0
  fi
  [ $((now - success)) -le "$maximum_age" ] || return 0
  return 1
}

run_reconciled_job() {
  local job=$1
  shift
  BACKUP_JITTER_MAX_SECONDS=0 "$run_job" "$job" "$@"
}

if job_is_overdue full "${BACKUP_FULL_MAX_AGE_SECONDS:-691200}"; then
  run_reconciled_job full "$pgbackrest_bin" \
    --config="$config_path" --stanza="$stanza" --type=full backup
  exit $?
fi

if job_is_overdue differential "${BACKUP_DIFFERENTIAL_MAX_AGE_SECONDS:-93600}"; then
  run_reconciled_job differential "$pgbackrest_bin" \
    --config="$config_path" --stanza="$stanza" --type=diff backup
  exit $?
fi

if job_is_overdue incremental "${BACKUP_INCREMENTAL_MAX_AGE_SECONDS:-7200}"; then
  run_reconciled_job incremental "$pgbackrest_bin" \
    --config="$config_path" --stanza="$stanza" --type=incr backup
  exit $?
fi

if job_is_overdue check "${BACKUP_CHECK_MAX_AGE_SECONDS:-25200}"; then
  run_reconciled_job check "$pgbackrest_bin" \
    --config="$config_path" --stanza="$stanza" check
  exit $?
fi
