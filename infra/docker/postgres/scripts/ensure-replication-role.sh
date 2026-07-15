#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

role=$(require_scalar_value POSTGRES_REPLICATION_ROLE "${POSTGRES_REPLICATION_ROLE:-postgres_backup}")
password_source=${POSTGRES_REPLICATION_PASSWORD_FILE:-}
require_scalar_file \
  POSTGRES_REPLICATION_PASSWORD \
  "$password_source" >/dev/null

credential_dir=$(mktemp -d "${TMPDIR:-/tmp}/replication-role.XXXXXX")
cleanup() {
  rm -rf -- "$credential_dir"
}
trap cleanup EXIT
chmod 0700 "$credential_dir"
install -m 0600 "$password_source" "$credential_dir/password"
printf '\\set password `cat %s`\n' "$credential_dir/password" \
  >"$credential_dir/psqlrc"
chmod 0600 "$credential_dir/psqlrc"

replication_enabled=$(
  PSQLRC="$credential_dir/psqlrc" psql \
    --host "${POSTGRES_SOCKET_DIR:-/var/run/postgresql}" \
    --username "${POSTGRES_USER:-trading_rpc}" \
    --dbname "${POSTGRES_DB:-trading_rpc}" \
    --quiet \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    -v role="$role" <<'SQL'
SELECT format('CREATE ROLE %I WITH LOGIN REPLICATION PASSWORD %L', :'role', :'password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN REPLICATION PASSWORD %L', :'role', :'password') \gexec
SELECT rolreplication FROM pg_roles WHERE rolname = :'role';
SQL
)

if [ "$(printf '%s' "$replication_enabled" | tr -d '[:space:]')" != t ]; then
  printf 'PostgreSQL replication role verification failed\n' >&2
  exit 1
fi
