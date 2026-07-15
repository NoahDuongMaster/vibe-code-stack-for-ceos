#!/usr/bin/env bash
set -Eeuo pipefail

. /usr/local/bin/postgres-backup/render-pgbackrest-config.sh

if [ "${POSTGRES_BACKUP_MODE:-disabled}" = enabled ]; then
  install -d -o postgres -g postgres -m 0700 /run/postgres-backup
  render_pgbackrest_config /run/postgres-backup/pgbackrest.conf
  chown postgres:postgres /run/postgres-backup/pgbackrest.conf
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
