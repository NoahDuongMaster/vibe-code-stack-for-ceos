#!/usr/bin/env bash
set -Eeuo pipefail

. /usr/local/bin/postgres-backup/render-pgbackrest-config.sh

backup_mode=$(require_backup_mode "${POSTGRES_BACKUP_MODE:-disabled}")
if [ "$backup_mode" = enabled ]; then
  install -d -o postgres -g postgres -m 0700 /run/postgres-backup
  render_pgbackrest_config /run/postgres-backup/pgbackrest.conf
  chown postgres:postgres /run/postgres-backup/pgbackrest.conf
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
