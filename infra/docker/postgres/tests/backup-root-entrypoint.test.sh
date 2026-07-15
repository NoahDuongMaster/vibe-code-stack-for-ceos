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

docker run --rm \
  --entrypoint /test-entrypoint.sh \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add SETGID \
  --cap-add SETUID \
  --security-opt no-new-privileges:true \
  --tmpfs /run/postgres-backup-secrets:rw,noexec,nosuid,nodev,mode=0700 \
  --mount "type=bind,source=$ROOT/infra/docker/postgres/scripts/backup-root-entrypoint.sh,target=/test-entrypoint.sh,readonly" \
  --mount "type=bind,source=$tmp/source,target=/run/secrets,readonly" \
  --env POSTGRES_BACKUP_MODE=enabled \
  --env POSTGRES_RUNTIME_USER=70:70 \
  --env POSTGRES_RUNTIME_UID=70 \
  --env POSTGRES_RUNTIME_GID=70 \
  --env POSTGRES_REPLICATION_PASSWORD_SOURCE_FILE=/run/secrets/replication \
  --env R2_PITR_ACCESS_KEY_ID_SOURCE_FILE=/run/secrets/pitr-key \
  --env R2_PITR_SECRET_ACCESS_KEY_SOURCE_FILE=/run/secrets/pitr-secret \
  --env R2_ARCHIVE_ACCESS_KEY_ID_SOURCE_FILE=/run/secrets/archive-key \
  --env R2_ARCHIVE_SECRET_ACCESS_KEY_SOURCE_FILE=/run/secrets/archive-secret \
  --env PGBACKREST_CIPHER_PASSPHRASE_SOURCE_FILE=/run/secrets/cipher \
  postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15 \
  sh -ec 'test "$(id -u)" = 70; for secret in /run/postgres-backup-secrets/*; do test -r "$secret"; done'
printf 'ok - backup root entrypoint\n'
