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
TRADING_RPC_RUNTIME_DIR="$tmp/runtime" \
TRADING_RPC_RUNTIME_SECRET_DIR="$tmp/runtime/secrets" \
GOSU_ARGUMENTS="$tmp/arguments" DATABASE_URL_FILE_OUTPUT="$tmp/database-file" \
  "$ROOT/infra/docker/trading-rpc-entrypoint.sh" node dist/index.js

assert_eq "$(cat "$tmp/arguments")" 'apinode node dist/index.js'
assert_eq "$(cat "$tmp/database-file")" "$tmp/runtime/secrets/database-url"
assert_file_mode "$tmp/runtime" 700
assert_file_mode "$tmp/runtime/secrets" 700
assert_file_mode "$tmp/runtime/secrets/database-url" 600
assert_eq "$(cat "$tmp/runtime/secrets/database-url")" \
  'postgresql://user:password@postgres/trading_rpc'

docker run --rm \
  --entrypoint /test-entrypoint.sh \
  --tmpfs /run/trading-rpc:rw,noexec,nosuid,nodev,mode=0700 \
  --mount "type=bind,source=$ROOT/infra/docker/trading-rpc-entrypoint.sh,target=/test-entrypoint.sh,readonly" \
  --mount "type=bind,source=$tmp/source,target=/run/secrets/database-url,readonly" \
  --env TRADING_RPC_RUNTIME_USER=1001:1001 \
  --env TRADING_RPC_RUNTIME_UID=1001 \
  --env TRADING_RPC_RUNTIME_GID=1001 \
  --env TRADING_RPC_DATABASE_URL_SOURCE_FILE=/run/secrets/database-url \
  postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15 \
  sh -ec 'test "$(id -u)" = 1001; test -r "$DATABASE_URL_FILE"; cat "$DATABASE_URL_FILE" >/dev/null'
printf 'ok - trading-rpc root entrypoint\n'
