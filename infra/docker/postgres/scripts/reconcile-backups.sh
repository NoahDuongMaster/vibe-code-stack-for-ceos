#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

state_dir=${POSTGRES_BACKUP_STATE_DIR:-/var/lib/postgres-backup/state}
run_job=${BACKUP_RUN_JOB_BIN:-$SCRIPT_DIR/run-backup-job.sh}
pgbackrest_bin=${BACKUP_PGBACKREST_BIN:-pgbackrest}
config_path=${POSTGRES_BACKUP_CONFIG_PATH:-/run/postgres-backup/pgbackrest.conf}
stanza=${POSTGRES_BACKUP_STANZA:-trading-rpc}
now=$(date +%s)

if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != --preflight-complete ]; }; then
  printf 'usage: reconcile-backups.sh [--preflight-complete]\n' >&2
  exit 64
fi

install -d -m 0700 "$state_dir"

if [ "${1:-}" != --preflight-complete ]; then
  "$pgbackrest_bin" --config="$config_path" --stanza="$stanza" stanza-create
  "$pgbackrest_bin" --config="$config_path" --stanza="$stanza" check
fi

state_number() {
  local path=$1
  local expression=$2
  [ -r "$path" ] || {
    printf '0'
    return
  }
  jq -er "$expression | select(type == \"number\")" "$path" 2>/dev/null || printf '0'
}

job_is_overdue() {
  local job=$1
  local maximum_age=$2
  local success
  local failure

  success=$(state_number "$state_dir/$job.last-success.json" '.finishedEpochSeconds')
  failure=$(state_number "$state_dir/$job.last-failure.json" '.finishedEpochSeconds')
  [ "$success" -gt 0 ] || return 0
  [ "$failure" -le "$success" ] || return 0
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
