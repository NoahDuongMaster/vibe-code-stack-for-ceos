#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/render-pgbackrest-config.sh"

runtime_uid=${POSTGRES_RUNTIME_UID:-70}
runtime_gid=${POSTGRES_RUNTIME_GID:-70}
runtime_secret_dir=${POSTGRES_BACKUP_RUNTIME_SECRET_DIR:-/run/postgres-backup/secrets}
password_source=${POSTGRES_PASSWORD_SOURCE_FILE:-}

if [ -n "$password_source" ]; then
  [ -r "$password_source" ] || {
    printf 'PostgreSQL password secret is not readable\n' >&2
    exit 1
  }
  if [ "$(id -u)" -eq 0 ]; then
    install -d -o "$runtime_uid" -g "$runtime_gid" -m 0700 "$runtime_secret_dir"
    install -o "$runtime_uid" -g "$runtime_gid" -m 0600 \
      "$password_source" "$runtime_secret_dir/postgres-password"
  else
    [ "$(id -u)" = "$runtime_uid" ] && [ "$(id -g)" = "$runtime_gid" ] || {
      printf 'PostgreSQL password bootstrap must run as root\n' >&2
      exit 1
    }
    install -d -m 0700 "$runtime_secret_dir"
    install -m 0600 "$password_source" "$runtime_secret_dir/postgres-password"
  fi
  export POSTGRES_PASSWORD_FILE="$runtime_secret_dir/postgres-password"
  unset POSTGRES_PASSWORD_SOURCE_FILE
fi

backup_mode=$(require_backup_mode "${POSTGRES_BACKUP_MODE:-disabled}")
if [ "$backup_mode" = enabled ]; then
  install -d -o postgres -g postgres -m 0700 /run/postgres-backup
  render_pgbackrest_config /run/postgres-backup/pgbackrest.conf
  chown postgres:postgres /run/postgres-backup/pgbackrest.conf
fi

exec "${POSTGRES_OFFICIAL_ENTRYPOINT:-/usr/local/bin/docker-entrypoint.sh}" "$@"
