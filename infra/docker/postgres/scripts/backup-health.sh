#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

state_dir=${POSTGRES_BACKUP_STATE_DIR:-/var/lib/postgres-backup/state}
wal_status_dir=${POSTGRES_WAL_ARCHIVE_STATUS_DIR:-/var/lib/postgresql/18/docker/pg_wal/archive_status}
postgres_data_dir=${POSTGRES_DATA_DIR:-/var/lib/postgresql/18/docker}
backup_spool_dir=${POSTGRES_BACKUP_SPOOL_DIR:-/var/spool/pgbackrest}
backup_stage_dir=${POSTGRES_BACKUP_STAGE_DIR:-/var/lib/postgres-backup/stage}
psql_bin=${BACKUP_PSQL_BIN:-psql}
df_bin=${BACKUP_DF_BIN:-df}
stat_bin=${BACKUP_STAT_BIN:-stat}
priority_lock_wait=${BACKUP_PRIORITY_LOCK_WAIT_SECONDS:-21600}
disk_high_water=${BACKUP_DISK_HIGH_WATER_PERCENT:-85}

readonly PHYSICAL_MAX_AGE_SECONDS=7200
readonly DIFFERENTIAL_MAX_AGE_SECONDS=93600
readonly FULL_MAX_AGE_SECONDS=691200
readonly MONTHLY_MAX_AGE_SECONDS=3024000
readonly PITR_DRILL_MAX_AGE_SECONDS=691200
readonly MONTHLY_DRILL_MAX_AGE_SECONDS=3024000
readonly DRILL_MAX_DURATION_SECONDS=3600
readonly WAL_READY_MAX_AGE_SECONDS=300

case "$priority_lock_wait:$disk_high_water" in
  *[!0-9:]* | :* | *:)
    printf 'backup health thresholds must be non-negative integers\n' >&2
    exit 2
    ;;
esac

install -d -m 0700 "$state_dir"
now=$(date +%s)
checked_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
reasons=()

add_reason() {
  local candidate=$1
  local existing
  for existing in "${reasons[@]:-}"; do
    [ "$existing" != "$candidate" ] || return 0
  done
  reasons+=("$candidate")
}

state_number() {
  local path=$1
  local expression=$2
  [ -r "$path" ] || {
    printf '0'
    return
  }
  jq -er "$expression | select(type == \"number\")" "$path" 2>/dev/null || printf '0'
}

success_epoch() {
  state_number "$state_dir/$1.last-success.json" '.finishedEpochSeconds'
}

success_duration() {
  state_number "$state_dir/$1.last-success.json" '.durationSeconds'
}

is_stale() {
  local epoch=$1
  local maximum_age=$2
  [ "$epoch" -gt 0 ] && [ $((now - epoch)) -le "$maximum_age" ]
}

running_priority_physical() {
  local job
  local started
  for job in full differential; do
    started=$(state_number "$state_dir/$job.running.json" \
      '(.lockAcquiredEpochSeconds // .startedEpochSeconds)')
    if [ "$started" -gt 0 ] && [ $((now - started)) -le "$priority_lock_wait" ]; then
      return 0
    fi
  done
  return 1
}

incremental_epoch=$(success_epoch incremental)
differential_epoch=$(success_epoch differential)
full_epoch=$(success_epoch full)
latest_physical_epoch=$incremental_epoch
[ "$differential_epoch" -le "$latest_physical_epoch" ] || latest_physical_epoch=$differential_epoch
[ "$full_epoch" -le "$latest_physical_epoch" ] || latest_physical_epoch=$full_epoch

if ! is_stale "$latest_physical_epoch" "$PHYSICAL_MAX_AGE_SECONDS" && \
  ! running_priority_physical; then
  add_reason incremental_stale
fi
is_stale "$differential_epoch" "$DIFFERENTIAL_MAX_AGE_SECONDS" || \
  add_reason differential_stale
is_stale "$full_epoch" "$FULL_MAX_AGE_SECONDS" || add_reason full_stale

monthly_epoch=$(success_epoch monthly)
pitr_drill_epoch=$(success_epoch pitr-drill)
monthly_drill_epoch=$(success_epoch monthly-drill)
is_stale "$monthly_epoch" "$MONTHLY_MAX_AGE_SECONDS" || add_reason monthly_stale
is_stale "$pitr_drill_epoch" "$PITR_DRILL_MAX_AGE_SECONDS" || \
  add_reason pitr_drill_stale
is_stale "$monthly_drill_epoch" "$MONTHLY_DRILL_MAX_AGE_SECONDS" || \
  add_reason monthly_drill_stale

[ "$(success_duration pitr-drill)" -le "$DRILL_MAX_DURATION_SECONDS" ] || \
  add_reason pitr_drill_duration_exceeded
[ "$(success_duration monthly-drill)" -le "$DRILL_MAX_DURATION_SECONDS" ] || \
  add_reason monthly_drill_duration_exceeded

for job in incremental differential full monthly check verify pitr-drill monthly-drill; do
  success=$(success_epoch "$job")
  failure=$(state_number "$state_dir/$job.last-failure.json" '.finishedEpochSeconds')
  outcome_status=$(jq -er '.status | select(. == "success" or . == "failure")' \
    "$state_dir/$job.last-outcome.json" 2>/dev/null || true)
  if [ "$outcome_status" = failure ] || {
    [ -z "$outcome_status" ] && [ "$failure" -gt 0 ] && [ "$failure" -ge "$success" ];
  }; then
    add_reason "${job//-/_}_last_attempt_failed"
  fi
done

oldest_ready_age=0
if [ -d "$wal_status_dir" ]; then
  while IFS= read -r ready_path; do
    [ -n "$ready_path" ] || continue
    if ! ready_mtime=$(
      "$stat_bin" -c '%Y' "$ready_path" 2>/dev/null ||
        "$stat_bin" -f '%m' "$ready_path" 2>/dev/null
    ); then
      [ ! -e "$ready_path" ] && continue
      add_reason wal_archive_stat_failed
      continue
    fi
    ready_age=$((now - ready_mtime))
    [ "$ready_age" -le "$oldest_ready_age" ] || oldest_ready_age=$ready_age
    [ "$ready_age" -le "$WAL_READY_MAX_AGE_SECONDS" ] || add_reason wal_archive_stalled
  done < <(find "$wal_status_dir" -type f -name '*.ready' -print 2>/dev/null)
fi

archiver_failed_count=-1
if archiver_output=$(
  "$psql_bin" \
    --host "${POSTGRES_SOCKET_DIR:-/var/run/postgresql}" \
    --username "${POSTGRES_USER:-trading_rpc}" \
    --dbname "${POSTGRES_DB:-trading_rpc}" \
    --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command 'SELECT failed_count::bigint FROM pg_stat_archiver' 2>/dev/null
); then
  archiver_failed_count=$(printf '%s' "$archiver_output" | tr -d '[:space:]')
  case "$archiver_failed_count" in
    '' | *[!0-9]*)
      archiver_failed_count=-1
      add_reason archiver_query_failed
      ;;
  esac
else
  add_reason archiver_query_failed
fi

baseline_path="$state_dir/archiver-failed-count.baseline.json"
baseline_failed_count=$(state_number "$baseline_path" '.failedCount')
if [ "$archiver_failed_count" -ge 0 ] && \
  [ -r "$baseline_path" ] && \
  [ "$archiver_failed_count" -gt "$baseline_failed_count" ]; then
  add_reason archiver_failed_count_increased
fi

maximum_disk_percent=0
for disk_path in "$postgres_data_dir" "$backup_spool_dir" "$backup_stage_dir"; do
  if disk_output=$("$df_bin" -P "$disk_path" 2>/dev/null); then
    disk_percent=$(printf '%s\n' "$disk_output" | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')
    case "$disk_percent" in
      '' | *[!0-9]*) add_reason disk_check_failed ;;
      *)
        [ "$disk_percent" -le "$maximum_disk_percent" ] || \
          maximum_disk_percent=$disk_percent
        [ "$disk_percent" -lt "$disk_high_water" ] || add_reason disk_high_water
        ;;
    esac
  else
    add_reason disk_check_failed
  fi
done

if [ "${#reasons[@]}" -eq 0 ]; then
  health_status=healthy
  reasons_json='[]'
else
  health_status=unhealthy
  reasons_json=$(printf '%s\n' "${reasons[@]}" | jq -R . | jq -s .)
fi

atomic_write_json "$state_dir/health.json" -n \
  --arg status "$health_status" \
  --arg checkedAt "$checked_at" \
  --argjson checkedEpochSeconds "$now" \
  --argjson reasons "$reasons_json" \
  --argjson archiverFailedCount "$archiver_failed_count" \
  --argjson oldestReadyAgeSeconds "$oldest_ready_age" \
  --argjson maximumDiskPercent "$maximum_disk_percent" \
  '{status:$status,checkedAt:$checkedAt,
    checkedEpochSeconds:$checkedEpochSeconds,reasons:$reasons,
    metrics:{archiverFailedCount:$archiverFailedCount,
      oldestReadyAgeSeconds:$oldestReadyAgeSeconds,
      maximumDiskPercent:$maximumDiskPercent}}'

if [ "$archiver_failed_count" -ge 0 ]; then
  atomic_write_json "$baseline_path" -n \
    --argjson failedCount "$archiver_failed_count" \
    --arg recordedAt "$checked_at" \
    --argjson recordedEpochSeconds "$now" \
    '{failedCount:$failedCount,recordedAt:$recordedAt,
      recordedEpochSeconds:$recordedEpochSeconds}'
fi

if [ "$health_status" = healthy ]; then
  json_log info backup_health_evaluated "$health_status"
else
  json_log error backup_health_evaluated "$health_status"
fi
[ "$health_status" = healthy ]
