#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/secrets"

cat >"$tmp/bin/aws" <<'EOF'
#!/usr/bin/env sh
cat <<'JSON'
{"POSTGRES_PASSWORD":"p@ss word:/","POSTGRES_REPLICATION_PASSWORD":"replication-pass","R2_PITR_ACCESS_KEY_ID":"pitr-key","R2_PITR_SECRET_ACCESS_KEY":"pitr-secret","R2_ARCHIVE_ACCESS_KEY_ID":"archive-key","R2_ARCHIVE_SECRET_ACCESS_KEY":"archive-secret","PGBACKREST_CIPHER_PASSPHRASE":"cipher-pass"}
JSON
EOF
chmod +x "$tmp/bin/aws"

output=$(PATH="$tmp/bin:$PATH" \
  POSTGRES_BACKUP_RUNTIME_SECRET_ID=production/postgres-backup \
  POSTGRES_BACKUP_SECRET_DIR="$tmp/secrets" \
  POSTGRES_USER=trading_rpc POSTGRES_DB=trading_rpc \
  "$ROOT/infra/docker/postgres/scripts/sync-production-secrets.sh")

assert_eq "$output" ''
for secret in \
  postgres-password postgres-replication-password \
  r2-pitr-access-key-id r2-pitr-secret-access-key \
  r2-archive-access-key-id r2-archive-secret-access-key \
  pgbackrest-cipher-passphrase trading-rpc-database-url; do
  [ -f "$tmp/secrets/$secret" ] || fail "missing generated secret: $secret"
  assert_file_mode "$tmp/secrets/$secret" 600
done
assert_eq "$(cat "$tmp/secrets/trading-rpc-database-url")" \
  'postgresql://trading_rpc:p%40ss%20word%3A%2F@postgres:5432/trading_rpc'
printf 'ok - production secret sync\n'
