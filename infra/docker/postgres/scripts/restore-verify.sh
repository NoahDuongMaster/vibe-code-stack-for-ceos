#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/restore-lib.sh"

pg_ctl_bin=${PG_CTL_BIN:-pg_ctl}
pg_isready_bin=${BACKUP_PG_ISREADY_BIN:-pg_isready}
psql_bin=${PSQL_BIN:-psql}
runtime_dir=${POSTGRES_BACKUP_RUNTIME_DIR:-/run/postgres-backup}
postgres_port=${POSTGRES_RESTORE_PORT:-55432}
expected_major=${POSTGRES_EXPECTED_MAJOR_VERSION:-18}
postgres_user=$(require_scalar_value POSTGRES_USER "${POSTGRES_USER:-trading_rpc}")
target_dir=''
backup_id=''
target_time=''
started_monotonic=''
expected_system_identifier=''
postgres_started=false
postgres_start_attempted=false
result_published=false
failure_category=verification_validation_failed
socket_dir=''

usage() {
  printf 'usage: restore-verify.sh --target-dir PATH --backup-id ID --target-time VALUE --started-monotonic SECONDS --expected-system-identifier ID\n' >&2
  exit 64
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir) [ "$#" -ge 2 ] || usage; target_dir=$2; shift 2 ;;
    --backup-id) [ "$#" -ge 2 ] || usage; backup_id=$2; shift 2 ;;
    --target-time) [ "$#" -ge 2 ] || usage; target_time=$2; shift 2 ;;
    --started-monotonic) [ "$#" -ge 2 ] || usage; started_monotonic=$2; shift 2 ;;
    --expected-system-identifier)
      [ "$#" -ge 2 ] || usage
      expected_system_identifier=$2
      shift 2
      ;;
    *) usage ;;
  esac
done

target_dir=$(require_existing_restore_target "$target_dir")
backup_id=$(require_scalar_value BACKUP_ID "$backup_id")
target_time=$(require_scalar_value TARGET_TIME "$target_time")
[[ "$backup_id" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$ ]] || usage
[[ "$started_monotonic" =~ ^[0-9]+$ ]] || usage
[[ "$expected_system_identifier" =~ ^[0-9]+$ ]] || usage
[[ "$expected_major" =~ ^[0-9]+$ ]] || usage
case "$postgres_port" in '' | *[!0-9]*) usage ;; esac
[ "$postgres_port" -gt 0 ] && [ "$postgres_port" -le 65535 ] || usage

result_path="$target_dir/restore-result.json"
install -d -m 0700 "$runtime_dir"
socket_dir=$(mktemp -d "$runtime_dir/restore-socket.XXXXXX")
chmod 0700 "$socket_dir"

publish_result() {
  local status=$1
  local error_category=$2
  local duration
  local checks_json=${3:-'{}'}

  duration=$(restore_elapsed_seconds "$started_monotonic")
  atomic_write_json "$result_path" -n \
    --arg backupId "$backup_id" \
    --arg targetTime "$target_time" \
    --arg status "$status" \
    --arg errorCategory "$error_category" \
    --argjson durationSeconds "$duration" \
    --argjson checks "$checks_json" \
    '{schemaVersion:1,backupId:$backupId,targetTime:$targetTime,
      durationSeconds:$durationSeconds,status:$status,
      errorCategory:$errorCategory,checks:$checks}'
  result_published=true
}

cleanup() {
  local status=$?

  trap - EXIT
  [ "$status" -ne 124 ] || failure_category=restore_timeout
  if [ "$postgres_start_attempted" = true ]; then
    "$timeout_bin" --foreground --signal=TERM --kill-after=10 30 \
      "$pg_ctl_bin" -D "$target_dir" -m fast -w stop >/dev/null 2>&1 || true
  fi
  [ -z "$socket_dir" ] || rm -rf -- "$socket_dir"
  if [ "$result_published" != true ]; then
    publish_result failure "$failure_category" '{}' >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

postgres_options="-c listen_addresses='' -c unix_socket_directories='$socket_dir' -c unix_socket_permissions=0700 -c port=$postgres_port -c archive_mode=off -c archive_command=''"
failure_category=postgres_start_failed
postgres_start_attempted=true
if run_with_restore_deadline "$started_monotonic" \
  "$pg_ctl_bin" -D "$target_dir" -o "$postgres_options" -w start \
  >/dev/null; then
  postgres_started=true
else
  status=$?
  [ "$status" -ne 124 ] || failure_category=restore_timeout
  exit "$status"
fi

failure_category=postgres_readiness_failed
run_with_restore_deadline "$started_monotonic" \
  "$pg_isready_bin" --host "$socket_dir" --port "$postgres_port" \
  --dbname postgres >/dev/null

psql_query() {
  local database=$1
  local query=$2

  run_with_restore_deadline "$started_monotonic" \
    "$psql_bin" --host "$socket_dir" --port "$postgres_port" \
    --username "$postgres_user" --dbname "$database" --quiet --tuples-only --no-align \
    --set ON_ERROR_STOP=1 --command "$query"
}

failure_category=cluster_identity_failed
server_version_num=$(psql_query postgres 'SHOW server_version_num' | tr -d '[:space:]')
[[ "$server_version_num" =~ ^[0-9]+$ ]] && \
  [ "$((server_version_num / 10000))" -eq "$expected_major" ] || exit 65

data_checksums=$(psql_query postgres 'SHOW data_checksums' | tr -d '[:space:]')
[ "$data_checksums" = on ] || exit 65

system_identifier=$(psql_query postgres \
  'SELECT system_identifier FROM pg_control_system()' | \
  tr -d '[:space:]')
[ "$system_identifier" = "$expected_system_identifier" ] || exit 65

failure_category=database_integrity_failed
database_exists=$(psql_query postgres \
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'trading_rpc')" | \
  tr -d '[:space:]')
[ "$database_exists" = t ] || exit 65

drizzle_exists=$(psql_query trading_rpc \
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL" | \
  tr -d '[:space:]')
[ "$drizzle_exists" = t ] || exit 65

market_snapshots_exists=$(psql_query trading_rpc \
    "SELECT to_regclass('market_data.market_snapshots') IS NOT NULL" | \
  tr -d '[:space:]')
[ "$market_snapshots_exists" = t ] || exit 65

select_one=$(psql_query trading_rpc 'SELECT 1' | tr -d '[:space:]')
[ "$select_one" = 1 ] || exit 65

failure_category=postgres_stop_failed
run_with_restore_deadline "$started_monotonic" \
  "$pg_ctl_bin" -D "$target_dir" -m fast -w stop >/dev/null
postgres_started=false
postgres_start_attempted=false

duration=$(restore_elapsed_seconds "$started_monotonic")
[ "$duration" -lt "$restore_timeout_seconds" ] || {
  failure_category=restore_timeout
  exit 124
}
checks=$(jq -cn \
  --argjson serverVersionNum "$server_version_num" \
  --arg systemIdentifier "$system_identifier" \
  '{postgresReady:true,serverVersionNum:$serverVersionNum,dataChecksums:true,
    systemIdentifier:$systemIdentifier,database:true,
    drizzleMigrations:true,marketSnapshots:true,selectOne:true}')
publish_result success none "$checks"
