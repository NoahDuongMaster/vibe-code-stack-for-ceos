#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'database-password\n' >"$tmp/source-password"
chmod 0600 "$tmp/source-password"
cat >"$tmp/official-entrypoint" <<'EOF'
#!/usr/bin/env sh
printf '%s\n' "$*" >"$OFFICIAL_ARGUMENTS"
printf '%s' "$POSTGRES_PASSWORD_FILE" >"$OFFICIAL_PASSWORD_FILE"
EOF
chmod +x "$tmp/official-entrypoint"

POSTGRES_BACKUP_MODE=disabled \
POSTGRES_RUNTIME_UID="$(id -u)" POSTGRES_RUNTIME_GID="$(id -g)" \
POSTGRES_PASSWORD_SOURCE_FILE="$tmp/source-password" \
POSTGRES_BACKUP_RUNTIME_SECRET_DIR="$tmp/runtime" \
POSTGRES_OFFICIAL_ENTRYPOINT="$tmp/official-entrypoint" \
OFFICIAL_ARGUMENTS="$tmp/arguments" OFFICIAL_PASSWORD_FILE="$tmp/password-file" \
  "$ROOT/infra/docker/postgres/scripts/postgres-entrypoint.sh" postgres

assert_eq "$(cat "$tmp/arguments")" postgres
assert_eq "$(cat "$tmp/password-file")" "$tmp/runtime/postgres-password"
assert_file_mode "$tmp/runtime/postgres-password" 600
printf 'ok - postgres entrypoint secret ownership\n'
