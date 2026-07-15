#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

dockerfile="$ROOT/infra/docker/postgres.Dockerfile"
[ -f "$dockerfile" ] || fail 'PostgreSQL backup Dockerfile is missing'
assert_file_contains "$dockerfile" \
  'FROM postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15'
for package in \
  'age=1.3.1-r5' \
  'aws-cli=2.34.63-r0' \
  'pgbackrest=2.58.0-r0' \
  'rclone=1.74.1-r1'; do
  assert_file_contains "$dockerfile" "$package"
done
assert_file_contains "$dockerfile" \
  'ENTRYPOINT ["/usr/local/bin/postgres-backup/postgres-entrypoint.sh"]'
printf 'ok - pinned image contract\n'

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'pitr-key\n' >"$tmp/key"
printf 'pitr-secret\n' >"$tmp/secret"
printf 'cipher-passphrase\n' >"$tmp/cipher"

export POSTGRES_BACKUP_REPOSITORY_TYPE=r2
export POSTGRES_USER=trading_rpc POSTGRES_DB=trading_rpc
export R2_ACCOUNT_ID=account123 R2_PITR_BUCKET=trading-rpc-postgres-pitr
export R2_PITR_ACCESS_KEY_ID_FILE="$tmp/key"
export R2_PITR_SECRET_ACCESS_KEY_FILE="$tmp/secret"
export PGBACKREST_CIPHER_PASSPHRASE_FILE="$tmp/cipher"

. "$ROOT/infra/docker/postgres/scripts/render-pgbackrest-config.sh"
assert_eq "$(require_backup_mode enabled)" enabled
assert_eq "$(require_backup_mode disabled)" disabled
if require_backup_mode typo >/dev/null 2>&1; then
  fail 'invalid POSTGRES_BACKUP_MODE must be rejected'
fi
assert_file_contains "$ROOT/infra/docker/postgres/scripts/postgres-entrypoint.sh" \
  'backup_mode=$(require_backup_mode "${POSTGRES_BACKUP_MODE:-disabled}")'
printf 'ok - backup mode validation\n'

render_pgbackrest_config "$tmp/pgbackrest.conf"
assert_file_mode "$tmp/pgbackrest.conf" 600
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-type=s3'
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-s3-region=auto'
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-retention-full-type=time'
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-retention-full=35'
assert_file_contains "$tmp/pgbackrest.conf" 'archive-async=y'
assert_file_contains "$tmp/pgbackrest.conf" 'pg1-path=/var/lib/postgresql/18/docker'
printf 'ok - render R2 config\n'

export POSTGRES_BACKUP_REPOSITORY_TYPE=posix
unset R2_ACCOUNT_ID R2_PITR_BUCKET R2_PITR_ACCESS_KEY_ID_FILE
unset R2_PITR_SECRET_ACCESS_KEY_FILE PGBACKREST_CIPHER_PASSPHRASE_FILE
render_pgbackrest_config "$tmp/pgbackrest-posix.conf"
assert_file_mode "$tmp/pgbackrest-posix.conf" 600
assert_file_contains "$tmp/pgbackrest-posix.conf" 'repo1-type=posix'
assert_file_contains "$tmp/pgbackrest-posix.conf" 'repo1-path=/var/lib/pgbackrest/repo'
if grep -Eq 'repo1-(s3|cipher)' "$tmp/pgbackrest-posix.conf"; then
  fail 'POSIX config contains S3 credentials or cipher configuration'
fi
printf 'ok - render POSIX config\n'

printf 'first\nsecond\n' >"$tmp/multiline"
if require_scalar_file TEST_SECRET "$tmp/multiline" >/dev/null 2>&1; then
  fail 'multiline secret must be rejected'
fi
: >"$tmp/empty"
if require_scalar_file TEST_SECRET "$tmp/empty" >/dev/null 2>&1; then
  fail 'empty secret must be rejected'
fi
printf 'ok - reject invalid scalar files\n'

export POSTGRES_BACKUP_REPOSITORY_TYPE=r2
export R2_ACCOUNT_ID=account123 R2_PITR_BUCKET=trading-rpc-postgres-pitr
export R2_PITR_ACCESS_KEY_ID_FILE="$tmp/multiline"
export R2_PITR_SECRET_ACCESS_KEY_FILE="$tmp/secret"
export PGBACKREST_CIPHER_PASSPHRASE_FILE="$tmp/cipher"
if render_pgbackrest_config "$tmp/invalid.conf" >/dev/null 2>&1; then
  fail 'renderer must reject a multiline credential'
fi
[ ! -e "$tmp/invalid.conf" ] || fail 'renderer published an invalid config'
if find "$tmp" -name 'invalid.conf.tmp.*' | grep -q .; then
  fail 'renderer left a temporary config after validation failure'
fi
printf 'ok - fail closed without publishing config\n'

log_line=$(json_log info config_rendered 'configuration rendered')
assert_eq "$(printf '%s' "$log_line" | jq -r '.level + ":" + .event + ":" + .message')" \
  'info:config_rendered:configuration rendered'

atomic_write_json "$tmp/state.json" -n --arg status healthy '{status:$status}'
assert_file_mode "$tmp/state.json" 600
assert_eq "$(jq -r '.status' "$tmp/state.json")" healthy
if atomic_write_json "$tmp/invalid-state.json" -n 'not-valid-jq' >/dev/null 2>&1; then
  fail 'invalid jq expression must fail atomic JSON write'
fi
[ ! -e "$tmp/invalid-state.json" ] || fail 'invalid JSON state was published'
printf 'ok - JSON logging and atomic state\n'

mkdir "$tmp/bin"
cat >"$tmp/bin/sleep" <<'EOF'
#!/usr/bin/env sh
printf '%s\n' "$1" >>"$RETRY_SLEEP_LOG"
EOF
cat >"$tmp/bin/flaky" <<'EOF'
#!/usr/bin/env sh
count=0
[ ! -f "$RETRY_COUNT_FILE" ] || count=$(cat "$RETRY_COUNT_FILE")
count=$((count + 1))
printf '%s' "$count" >"$RETRY_COUNT_FILE"
[ "$count" -ge 4 ] || { printf 'temporary network error\n' >&2; exit 42; }
EOF
cat >"$tmp/bin/auth-failure" <<'EOF'
#!/usr/bin/env sh
count=0
[ ! -f "$RETRY_AUTH_COUNT_FILE" ] || count=$(cat "$RETRY_AUTH_COUNT_FILE")
count=$((count + 1))
printf '%s' "$count" >"$RETRY_AUTH_COUNT_FILE"
printf 'AccessDenied: authorization failed\n' >&2
exit 23
EOF
cat >"$tmp/bin/identity-failure" <<'EOF'
#!/usr/bin/env sh
count=0
[ ! -f "$RETRY_IDENTITY_COUNT_FILE" ] || count=$(cat "$RETRY_IDENTITY_COUNT_FILE")
count=$((count + 1))
printf '%s' "$count" >"$RETRY_IDENTITY_COUNT_FILE"
printf '%s\n' "$RETRY_IDENTITY_MESSAGE" >&2
exit 24
EOF
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH"
export RETRY_SLEEP_LOG="$tmp/sleeps" RETRY_COUNT_FILE="$tmp/retry-count"
retry_with_backoff "$tmp/bin/flaky" >/dev/null 2>&1
assert_eq "$(cat "$tmp/retry-count")" 4
assert_eq "$(paste -sd, "$tmp/sleeps")" '5,15,45'

export RETRY_AUTH_COUNT_FILE="$tmp/retry-auth-count"
if retry_with_backoff "$tmp/bin/auth-failure" >/dev/null 2>&1; then
  fail 'authentication failure must remain a failure'
fi
assert_eq "$(cat "$tmp/retry-auth-count")" 1

for identity_message in \
  'backup and archive info files exist but do not match' \
  'database system-id mismatch' \
  'database mismatch detected' \
  'DbMismatchError: database identity changed' \
  'BackupMismatchError: backup repository identity changed' \
  'ArchiveMismatchError: archive repository identity changed'; do
  export RETRY_IDENTITY_COUNT_FILE="$tmp/retry-identity-count"
  export RETRY_IDENTITY_MESSAGE="$identity_message"
  rm -f "$RETRY_IDENTITY_COUNT_FILE"
  if retry_with_backoff "$tmp/bin/identity-failure" >/dev/null 2>&1; then
    fail 'repository identity mismatch must remain a failure'
  fi
  assert_eq "$(cat "$RETRY_IDENTITY_COUNT_FILE")" 1
done
printf 'ok - bounded retry policy\n'
