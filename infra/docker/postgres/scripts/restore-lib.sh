#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

restore_root=${POSTGRES_RESTORE_ROOT:-/var/lib/postgres-backup/restores}
restore_timeout_seconds=${RESTORE_TIMEOUT_SECONDS:-3600}
timeout_bin=${RESTORE_TIMEOUT_BIN:-timeout}
realpath_bin=${RESTORE_REALPATH_BIN:-realpath}
date_bin=${BACKUP_DATE_BIN:-date}
restore_df_bin=${RESTORE_DF_BIN:-df}
restore_minimum_free_bytes=${POSTGRES_RESTORE_MIN_FREE_BYTES:-10737418240}

case "$restore_timeout_seconds" in
  '' | *[!0-9]*)
    printf 'RESTORE_TIMEOUT_SECONDS must be a positive integer\n' >&2
    exit 64
    ;;
esac
[ "$restore_timeout_seconds" -gt 0 ] || {
  printf 'RESTORE_TIMEOUT_SECONDS must be a positive integer\n' >&2
  exit 64
}
case "$restore_minimum_free_bytes" in
  '' | *[!0-9]*)
    printf 'POSTGRES_RESTORE_MIN_FREE_BYTES must be a positive integer\n' >&2
    exit 64
    ;;
esac
[ "$restore_minimum_free_bytes" -gt 0 ] || {
  printf 'POSTGRES_RESTORE_MIN_FREE_BYTES must be a positive integer\n' >&2
  exit 64
}

monotonic_seconds() {
  if [ -n "${RESTORE_MONOTONIC_SECONDS_FILE:-}" ]; then
    awk 'NR == 1 {print int($1)}' "$RESTORE_MONOTONIC_SECONDS_FILE"
  elif [ -r /proc/uptime ]; then
    awk 'NR == 1 {print int($1)}' /proc/uptime
  else
    "$date_bin" +%s
  fi
}

restore_elapsed_seconds() {
  local started=$1
  local now

  now=$(monotonic_seconds)
  [ "$now" -ge "$started" ] || now=$started
  printf '%s' "$((now - started))"
}

run_with_restore_deadline() {
  local started=$1
  local elapsed
  local remaining
  local status
  shift

  elapsed=$(restore_elapsed_seconds "$started")
  remaining=$((restore_timeout_seconds - elapsed))
  [ "$remaining" -gt 0 ] || return 124

  if "$timeout_bin" --foreground --signal=TERM --kill-after=30 \
    "$remaining" "$@"; then
    return 0
  else
    status=$?
  fi
  case "$status" in
    124 | 137) return 124 ;;
    *) return "$status" ;;
  esac
}

run_restore_pipeline_with_deadline() {
  local started=$1
  local pipeline=$2
  local elapsed
  local remaining
  local status
  shift 2

  elapsed=$(restore_elapsed_seconds "$started")
  remaining=$((restore_timeout_seconds - elapsed))
  [ "$remaining" -gt 0 ] || return 124

  if "$timeout_bin" --signal=TERM --kill-after=30 "$remaining" \
    bash -o pipefail -c "$pipeline" restore-pipeline "$@"; then
    return 0
  else
    status=$?
  fi
  case "$status" in
    124 | 137) return 124 ;;
    *) return "$status" ;;
  esac
}

require_restore_capacity() {
  local estimated_bytes=$1
  local required_bytes
  local available_kib
  local available_bytes

  case "$estimated_bytes" in
    '' | *[!0-9]*) return 64 ;;
  esac
  required_bytes=$estimated_bytes
  [ "$required_bytes" -ge "$restore_minimum_free_bytes" ] || \
    required_bytes=$restore_minimum_free_bytes
  available_kib=$("$restore_df_bin" -Pk "$restore_root" | \
    awk 'NR == 2 {print $4}')
  case "$available_kib" in
    '' | *[!0-9]*) return 74 ;;
  esac
  available_bytes=$((available_kib * 1024))
  [ "$available_bytes" -ge "$required_bytes" ] || return 75
}

require_restore_target() {
  local requested
  local canonical_root
  local canonical_target

  requested=$(require_scalar_value TARGET_DIR "$1") || return 1
  install -d -m 0700 "$restore_root"
  canonical_root=$("$realpath_bin" -- "$restore_root")
  if [ -e "$requested" ] || [ -L "$requested" ]; then
    canonical_target=$("$realpath_bin" -- "$requested")
  else
    requested_parent=$("$realpath_bin" -- "$(dirname -- "$requested")") || {
      printf 'restore target parent must already exist\n' >&2
      return 64
    }
    canonical_target="$requested_parent/$(basename -- "$requested")"
  fi

  [ "$canonical_target" != "$canonical_root" ] && \
    [[ "$canonical_target" == "$canonical_root/"* ]] || {
    printf 'restore target must be a child of POSTGRES_RESTORE_ROOT\n' >&2
    return 64
  }
  [ ! -L "$requested" ] || {
    printf 'restore target must not be a symbolic link\n' >&2
    return 64
  }
  if [ -e "$canonical_target" ]; then
    [ -d "$canonical_target" ] || {
      printf 'restore target must be a directory\n' >&2
      return 64
    }
    [ -z "$(find "$canonical_target" -mindepth 1 -print -quit)" ] || {
      printf 'restore target must be empty\n' >&2
      return 64
    }
  fi

  install -d -m 0700 "$canonical_target"
  chmod 0700 "$canonical_target"
  printf '%s' "$canonical_target"
}

require_existing_restore_target() {
  local requested
  local canonical_root
  local canonical_target

  requested=$(require_scalar_value TARGET_DIR "$1") || return 1
  canonical_root=$("$realpath_bin" -- "$restore_root")
  canonical_target=$("$realpath_bin" -- "$requested")
  [ "$canonical_target" != "$canonical_root" ] && \
    [[ "$canonical_target" == "$canonical_root/"* ]] && \
    [ -d "$canonical_target" ] && [ ! -L "$requested" ] || {
    printf 'existing restore target is outside POSTGRES_RESTORE_ROOT\n' >&2
    return 64
  }
  printf '%s' "$canonical_target"
}

require_rfc3339_not_future() {
  local value
  local epoch
  local now

  value=$(require_scalar_value TARGET_TIME "$1") || return 1
  [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$ ]] || {
    printf 'target time must be RFC3339\n' >&2
    return 64
  }
  epoch=$("$date_bin" --date="$value" +%s 2>/dev/null) || {
    printf 'target time is invalid\n' >&2
    return 64
  }
  now=$("$date_bin" +%s)
  [ "$epoch" -le "$now" ] || {
    printf 'target time must not be in the future\n' >&2
    return 64
  }
  printf '%s' "$value"
}

read_source_system_identifier() {
  local source_data_dir=${POSTGRES_SOURCE_DATA_DIR:-/var/lib/postgresql/18/docker}
  local pg_controldata_bin=${PG_CONTROLDATA_BIN:-pg_controldata}
  local identifier

  identifier=$(LC_ALL=C "$pg_controldata_bin" "$source_data_dir" 2>/dev/null | \
    awk -F: '/^Database system identifier:/ {gsub(/[[:space:]]/, "", $2); print $2}')
  [[ "$identifier" =~ ^[0-9]+$ ]] || {
    printf 'source PostgreSQL system identifier is invalid\n' >&2
    return 69
  }
  printf '%s' "$identifier"
}

publish_restore_failure_result() {
  local result_path=$1
  local backup_id=$2
  local target_time=$3
  local started=$4
  local error_category=$5
  local duration

  duration=$(restore_elapsed_seconds "$started")
  atomic_write_json "$result_path" -n \
    --arg backupId "$backup_id" \
    --arg targetTime "$target_time" \
    --arg errorCategory "$error_category" \
    --argjson durationSeconds "$duration" \
    '{schemaVersion:1,backupId:$backupId,targetTime:$targetTime,
      durationSeconds:$durationSeconds,status:"failure",
      errorCategory:$errorCategory,checks:{}}'
}

publish_drill_evidence() {
  local drill_name=$1
  local target_dir=$2
  local result_path="$target_dir/restore-result.json"
  local state_dir=${POSTGRES_BACKUP_STATE_DIR:-/var/lib/postgres-backup/state}
  local evidence_path="$state_dir/$drill_name.last-result.json"

  [[ "$drill_name" =~ ^(pitr-drill|monthly-drill)$ ]] || return 64
  [ -f "$result_path" ] || return 66
  install -d -m 0700 "$state_dir"
  atomic_write_json "$evidence_path" . "$result_path"
  rm -rf -- "$target_dir"
}
