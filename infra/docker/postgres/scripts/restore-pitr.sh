#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/restore-lib.sh"

pgbackrest_bin=${PGBACKREST_BIN:-pgbackrest}
verify_bin=${RESTORE_VERIFY_BIN:-$SCRIPT_DIR/restore-verify.sh}
config_path=${POSTGRES_BACKUP_CONFIG_PATH:-/run/postgres-backup/pgbackrest.conf}
stanza=${POSTGRES_BACKUP_STANZA:-trading-rpc}
target_dir=''
target_time=''
restore_latest=false
drill_mode=false
tablespace_dir=''
tablespace_created=false
failure_category=restore_validation_failed

usage() {
  printf 'usage: restore-pitr.sh --target-dir PATH (--latest | --target-time RFC3339)\n' >&2
  exit 64
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir)
      [ "$#" -ge 2 ] || usage
      target_dir=$2
      shift 2
      ;;
    --latest)
      restore_latest=true
      shift
      ;;
    --target-time)
      [ "$#" -ge 2 ] || usage
      target_time=$2
      shift 2
      ;;
    --drill) drill_mode=true; shift ;;
    *) usage ;;
  esac
done

if [ "$drill_mode" = true ]; then
  [ -z "$target_dir" ] || usage
  target_dir="$restore_root/pitr-drill-$("$date_bin" -u '+%Y%m%dT%H%M%SZ')-$$"
else
  [ -n "$target_dir" ] || usage
fi
if [ "$restore_latest" = true ]; then
  [ -z "$target_time" ] || usage
else
  [ -n "$target_time" ] || usage
  target_time=$(require_rfc3339_not_future "$target_time")
  pgbackrest_target_time=${target_time/T/ }
  if [[ "$pgbackrest_target_time" == *Z ]]; then
    pgbackrest_target_time=${pgbackrest_target_time%Z}+00
  fi
fi
target_dir=$(require_restore_target "$target_dir")

started_monotonic=$(monotonic_seconds)
result_path="$target_dir/restore-result.json"
result_backup_id=pitr-pending
result_target_time=${target_time:-latest}

cleanup() {
  local status=$?

  trap - EXIT
  if [ "$status" -ne 0 ] && [ ! -f "$result_path" ]; then
    [ "$status" -ne 124 ] || failure_category=restore_timeout
    publish_restore_failure_result "$result_path" "$result_backup_id" \
      "$result_target_time" "$started_monotonic" "$failure_category" \
      >/dev/null 2>&1 || true
  fi
  if [ "$drill_mode" = true ] && [ -d "$target_dir" ] && \
    [ -f "$result_path" ]; then
    publish_drill_evidence pitr-drill "$target_dir" >/dev/null 2>&1 || \
      rm -rf -- "$target_dir"
  fi
  if [ "$drill_mode" = true ] && [ "$tablespace_created" = true ]; then
    rm -rf -- "$tablespace_dir"
  fi
  exit "$status"
}
trap cleanup EXIT

failure_category=repository_metadata_failed
repository_info=$(run_with_restore_deadline "$started_monotonic" \
  "$pgbackrest_bin" --config="$config_path" --stanza="$stanza" \
  --output=json info)
tablespace_dir="$target_dir.tablespaces"
[ ! -e "$tablespace_dir" ] && [ ! -L "$tablespace_dir" ] || {
  printf 'restore tablespace target must not already exist\n' >&2
  exit 64
}
install -d -m 0700 "$tablespace_dir"
tablespace_created=true

restore_arguments=(
  --config="$config_path"
  --stanza="$stanza"
  --pg1-path="$target_dir"
  --tablespace-map-all="$tablespace_dir"
  --target-action=promote
)
if [ "$restore_latest" = true ]; then
  backup_record=$(jq -cer \
    '.[0].backup | max_by(.timestamp.stop)' <<<"$repository_info")
else
  target_epoch=$("$date_bin" --date="$target_time" +%s)
  backup_record=$(jq -cer --argjson targetEpoch "$target_epoch" \
    '.[0].backup | map(select(.timestamp.stop <= $targetEpoch)) |
     max_by(.timestamp.stop)' <<<"$repository_info")
  restore_arguments+=(--type=time --target="$pgbackrest_target_time")
fi
backup_id=$(jq -er '.label | strings' <<<"$backup_record")
backup_database_id=$(jq -er '.database.id | numbers | select(floor == .)' \
  <<<"$backup_record")
backup_repo_key=$(jq -er '.database."repo-key" | numbers | select(floor == .)' \
  <<<"$backup_record")
database_record=$(jq -cer \
  --argjson databaseId "$backup_database_id" \
  --argjson repoKey "$backup_repo_key" \
  '.[0].db | map(select(.id == $databaseId and ."repo-key" == $repoKey)) |
   if length == 1 then .[0] else error("backup database history is ambiguous") end' \
  <<<"$repository_info")
expected_system_identifier=$(jq -er \
  '."system-id" | tostring | select(test("^[0-9]+$"))' \
  <<<"$database_record")
expected_major=$(jq -er \
  '.version | tostring | capture("^(?<major>[0-9]+)").major' \
  <<<"$database_record")
backup_size=$(jq -er '.info.size | numbers | select(floor == . and . > 0)' \
  <<<"$backup_record" 2>/dev/null || printf '0')
failure_category=restore_capacity_failed
require_restore_capacity "$((backup_size * 2))" || exit $?
restore_arguments+=(--set="$backup_id" restore)

result_backup_id=$backup_id
failure_category=pitr_restore_failed
if run_with_restore_deadline "$started_monotonic" \
  "$pgbackrest_bin" "${restore_arguments[@]}"; then
  :
else
  status=$?
  [ "$status" -ne 124 ] || exit 124
  exit "$status"
fi

export RESTORE_VERIFY_RESULT_PATH=${RESTORE_VERIFY_RESULT_PATH:-$target_dir/restore-result.json}
export POSTGRES_EXPECTED_MAJOR_VERSION="$expected_major"
failure_category=restore_verification_failed
verify_arguments=(
  --target-dir "$target_dir"
  --backup-id "$backup_id"
  --started-monotonic "$started_monotonic"
  --expected-system-identifier "$expected_system_identifier"
)
if [ "$restore_latest" = true ]; then
  verify_arguments+=(--target-time latest)
else
  verify_arguments+=(--target-time "$target_time")
fi

if run_with_restore_deadline "$started_monotonic" \
  "$verify_bin" "${verify_arguments[@]}"; then
  :
else
  status=$?
  [ "$status" -ne 124 ] || exit 124
  exit "$status"
fi

if [ "$drill_mode" = true ]; then
  publish_drill_evidence pitr-drill "$target_dir"
  rm -rf -- "$tablespace_dir"
  tablespace_created=false
fi
