#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'postgresql://user:password@postgres/trading_rpc\n' >"$tmp/source"
chmod 0600 "$tmp/source"
cat >"$tmp/gosu" <<'EOF'
#!/usr/bin/env sh
printf '%s\n' "$*" >"$GOSU_ARGUMENTS"
printf '%s' "$DATABASE_URL_FILE" >"$DATABASE_URL_FILE_OUTPUT"
EOF
chmod +x "$tmp/gosu"

TRADING_RPC_RUNTIME_UID="$(id -u)" TRADING_RPC_RUNTIME_GID="$(id -g)" \
TRADING_RPC_RUNTIME_USER=apinode GOSU_BIN="$tmp/gosu" \
TRADING_RPC_DATABASE_URL_SOURCE_FILE="$tmp/source" \
TRADING_RPC_RUNTIME_SECRET_DIR="$tmp/runtime" \
GOSU_ARGUMENTS="$tmp/arguments" DATABASE_URL_FILE_OUTPUT="$tmp/database-file" \
  "$ROOT/infra/docker/trading-rpc-entrypoint.sh" node dist/index.js

assert_eq "$(cat "$tmp/arguments")" 'apinode node dist/index.js'
assert_eq "$(cat "$tmp/database-file")" "$tmp/runtime/database-url"
assert_file_mode "$tmp/runtime" 700
assert_file_mode "$tmp/runtime/database-url" 600
assert_eq "$(cat "$tmp/runtime/database-url")" \
  'postgresql://user:password@postgres/trading_rpc'
printf 'ok - trading-rpc root entrypoint\n'
