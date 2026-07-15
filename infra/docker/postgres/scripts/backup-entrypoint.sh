#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/render-pgbackrest-config.sh"

[ "$#" -eq 1 ] && [ "$1" = --prepare-only ] || {
  printf 'usage: backup-entrypoint.sh --prepare-only\n' >&2
  exit 64
}

backup_mode=$(require_backup_mode "${POSTGRES_BACKUP_MODE:-disabled}")
[ "$backup_mode" = enabled ] || {
  printf 'PostgreSQL backup sidecar requires POSTGRES_BACKUP_MODE=enabled\n' >&2
  exit 1
}

config_path=${POSTGRES_BACKUP_CONFIG_PATH:-/run/postgres-backup/pgbackrest.conf}
socket_dir=${POSTGRES_SOCKET_DIR:-/var/run/postgresql}
stanza=${POSTGRES_BACKUP_STANZA:-trading-rpc}
pg_isready_bin=${BACKUP_PG_ISREADY_BIN:-pg_isready}
ensure_role_bin=${BACKUP_ENSURE_REPLICATION_ROLE_BIN:-$SCRIPT_DIR/ensure-replication-role.sh}
pgbackrest_bin=${BACKUP_PGBACKREST_BIN:-pgbackrest}
reconcile_bin=${BACKUP_RECONCILE_BIN:-$SCRIPT_DIR/reconcile-backups.sh}
ready_wait_seconds=${POSTGRES_READY_WAIT_SECONDS:-300}
ready_poll_seconds=${POSTGRES_READY_POLL_SECONDS:-1}

case "$ready_wait_seconds" in
  '' | *[!0-9]*)
    printf 'POSTGRES_READY_WAIT_SECONDS must be a non-negative integer\n' >&2
    exit 64
    ;;
esac
if ! printf '%s\n' "$ready_poll_seconds" | grep -Eq '^[0-9]+([.][0-9]+)?$'; then
  printf 'POSTGRES_READY_POLL_SECONDS must be a non-negative number\n' >&2
  exit 64
fi

install -d -m 0700 "$(dirname -- "$config_path")"
render_pgbackrest_config "$config_path"

ready_deadline_ns=$(( $(date '+%s%N') + ready_wait_seconds * 1000000000 ))
ready_poll_ns=$(awk -v poll="$ready_poll_seconds" \
  'BEGIN { printf "%.0f", poll * 1000000000 }')
until "$pg_isready_bin" \
  --host "$socket_dir" \
  --username "${POSTGRES_USER:-trading_rpc}" \
  --dbname "${POSTGRES_DB:-trading_rpc}" >/dev/null 2>&1; do
  current_epoch_ns=$(date '+%s%N')
  if [ "$current_epoch_ns" -ge "$ready_deadline_ns" ]; then
    printf 'PostgreSQL did not become ready before the backup startup deadline\n' >&2
    exit 1
  fi
  remaining_ns=$((ready_deadline_ns - current_epoch_ns))
  bounded_poll_ns=$ready_poll_ns
  [ "$bounded_poll_ns" -le "$remaining_ns" ] || bounded_poll_ns=$remaining_ns
  bounded_poll_seconds=$(awk -v nanoseconds="$bounded_poll_ns" \
    'BEGIN { printf "%.9f", nanoseconds / 1000000000 }')
  sleep "$bounded_poll_seconds"
done

"$ensure_role_bin"
"$pgbackrest_bin" --config="$config_path" --stanza="$stanza" stanza-create
"$pgbackrest_bin" --config="$config_path" --stanza="$stanza" check
"$reconcile_bin" --preflight-complete
json_log info backup_scheduler_prepared 'backup scheduler prerequisites are ready'
