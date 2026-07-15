#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/secrets"

cat >"$tmp/bin/aws" <<'EOF'
#!/usr/bin/env sh
printf '%s\n' "$*" >>"$AWS_ARGUMENTS"
attempt=$(cat "$AWS_ATTEMPTS" 2>/dev/null || printf '0')
attempt=$((attempt + 1))
printf '%s' "$attempt" >"$AWS_ATTEMPTS"
if [ "$attempt" -lt 3 ]; then
  printf 'RequestTimeout: transient network failure\n' >&2
  exit 1
fi
cat <<'JSON'
{"POSTGRES_PASSWORD":"p@ss word:/","POSTGRES_REPLICATION_PASSWORD":"replication-pass","R2_PITR_ACCESS_KEY_ID":"pitr-key","R2_PITR_SECRET_ACCESS_KEY":"pitr-secret","R2_ARCHIVE_ACCESS_KEY_ID":"archive-key","R2_ARCHIVE_SECRET_ACCESS_KEY":"archive-secret","PGBACKREST_CIPHER_PASSPHRASE":"cipher-pass"}
JSON
EOF
cat >"$tmp/bin/sleep" <<'EOF'
#!/usr/bin/env sh
printf '%s\n' "$1" >>"$SLEEP_ARGUMENTS"
EOF
chmod +x "$tmp/bin/aws"
chmod +x "$tmp/bin/sleep"

output=$(PATH="$tmp/bin:$PATH" \
  AWS_ARGUMENTS="$tmp/aws-arguments" AWS_ATTEMPTS="$tmp/aws-attempts" \
  SLEEP_ARGUMENTS="$tmp/sleep-arguments" AWS_REGION=ap-southeast-1 \
  POSTGRES_BACKUP_RUNTIME_SECRET_ID=production/postgres-backup \
  POSTGRES_BACKUP_SECRET_DIR="$tmp/secrets" \
  POSTGRES_USER=trading_rpc POSTGRES_DB=trading_rpc \
  "$ROOT/infra/docker/postgres/scripts/sync-production-secrets.sh")

assert_eq "$output" ''
assert_eq "$(cat "$tmp/aws-attempts")" '3'
assert_file_contains "$tmp/aws-arguments" '--region ap-southeast-1'
assert_eq "$(tr '\n' ',' <"$tmp/sleep-arguments")" '5,15,'
[ -L "$tmp/secrets/current" ] || fail 'current secret generation is not an atomic symlink'
for secret in \
  postgres-password postgres-replication-password \
  r2-pitr-access-key-id r2-pitr-secret-access-key \
  r2-archive-access-key-id r2-archive-secret-access-key \
  pgbackrest-cipher-passphrase trading-rpc-database-url; do
  [ -f "$tmp/secrets/current/$secret" ] || fail "missing generated secret: $secret"
  assert_file_mode "$tmp/secrets/current/$secret" 600
done
assert_file_mode "$tmp/secrets/$(readlink "$tmp/secrets/current")" 700
assert_eq "$(cat "$tmp/secrets/current/trading-rpc-database-url")" \
  'postgresql://trading_rpc:p%40ss%20word%3A%2F@postgres:5432/trading_rpc'

previous_generation=$(readlink "$tmp/secrets/current")
cat >"$tmp/bin/aws" <<'EOF'
#!/usr/bin/env sh
printf '{"POSTGRES_PASSWORD":"incomplete"}\n'
EOF
chmod +x "$tmp/bin/aws"
if PATH="$tmp/bin:$PATH" AWS_REGION=ap-southeast-1 \
  POSTGRES_BACKUP_RUNTIME_SECRET_ID=production/postgres-backup \
  POSTGRES_BACKUP_SECRET_DIR="$tmp/secrets" \
  "$ROOT/infra/docker/postgres/scripts/sync-production-secrets.sh" \
  >"$tmp/invalid-output" 2>"$tmp/invalid-error"; then
  fail 'invalid generation unexpectedly replaced current secrets'
fi
assert_eq "$(readlink "$tmp/secrets/current")" "$previous_generation"

cat >"$tmp/bin/aws" <<'EOF'
#!/usr/bin/env sh
attempt=$(cat "$AWS_AUTH_ATTEMPTS" 2>/dev/null || printf '0')
printf '%s' "$((attempt + 1))" >"$AWS_AUTH_ATTEMPTS"
printf 'AccessDeniedException: not authorized\n' >&2
exit 1
EOF
chmod +x "$tmp/bin/aws"
if PATH="$tmp/bin:$PATH" AWS_REGION=ap-southeast-1 \
  AWS_AUTH_ATTEMPTS="$tmp/aws-auth-attempts" \
  POSTGRES_BACKUP_RUNTIME_SECRET_ID=production/postgres-backup \
  POSTGRES_BACKUP_SECRET_DIR="$tmp/secrets" \
  "$ROOT/infra/docker/postgres/scripts/sync-production-secrets.sh" \
  >"$tmp/auth-output" 2>"$tmp/auth-error"; then
  fail 'AWS authorization failure unexpectedly succeeded'
fi
assert_eq "$(cat "$tmp/aws-auth-attempts")" '1'
assert_eq "$(readlink "$tmp/secrets/current")" "$previous_generation"
printf 'ok - production secret sync\n'
