#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

assert_file_contains \
  "$ROOT/infra/docker/postgres/scripts/backup-root-entrypoint.sh" \
  ':-/run/postgres-backup-secrets}'

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/source" "$tmp/bin"
for secret in replication pitr-key pitr-secret archive-key archive-secret cipher; do
  printf '%s-value\n' "$secret" >"$tmp/source/$secret"
  chmod 0600 "$tmp/source/$secret"
done
cat >"$tmp/bin/gosu" <<'EOF'
#!/usr/bin/env sh
printf '%s\n' "$*" >"$GOSU_ARGUMENTS"
env | sort >"$GOSU_ENVIRONMENT"
EOF
chmod +x "$tmp/bin/gosu"

POSTGRES_BACKUP_MODE=enabled \
POSTGRES_RUNTIME_UID="$(id -u)" POSTGRES_RUNTIME_GID="$(id -g)" \
POSTGRES_RUNTIME_USER=postgres GOSU_BIN="$tmp/bin/gosu" \
POSTGRES_BACKUP_RUNTIME_SECRET_DIR="$tmp/runtime" \
POSTGRES_REPLICATION_PASSWORD_SOURCE_FILE="$tmp/source/replication" \
R2_PITR_ACCESS_KEY_ID_SOURCE_FILE="$tmp/source/pitr-key" \
R2_PITR_SECRET_ACCESS_KEY_SOURCE_FILE="$tmp/source/pitr-secret" \
R2_ARCHIVE_ACCESS_KEY_ID_SOURCE_FILE="$tmp/source/archive-key" \
R2_ARCHIVE_SECRET_ACCESS_KEY_SOURCE_FILE="$tmp/source/archive-secret" \
PGBACKREST_CIPHER_PASSPHRASE_SOURCE_FILE="$tmp/source/cipher" \
GOSU_ARGUMENTS="$tmp/gosu-arguments" GOSU_ENVIRONMENT="$tmp/gosu-environment" \
  "$ROOT/infra/docker/postgres/scripts/backup-root-entrypoint.sh" \
  /usr/local/bin/postgres-backup/backup-entrypoint.sh

assert_eq "$(cat "$tmp/gosu-arguments")" \
  'postgres /usr/local/bin/postgres-backup/backup-entrypoint.sh'
assert_file_mode "$tmp/runtime" 700
assert_file_mode "$tmp/runtime/postgres-replication-password" 600
assert_file_contains "$tmp/gosu-environment" \
  "POSTGRES_REPLICATION_PASSWORD_FILE=$tmp/runtime/postgres-replication-password"
printf 'ok - backup root entrypoint\n'
