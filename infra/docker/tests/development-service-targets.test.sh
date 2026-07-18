#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/bin"

cat >"$tmp/bin/docker" <<'EOF'
#!/bin/sh
set -eu
printf '%s\n' "$*" >>"${DOCKER_CALL_LOG:?}"
EOF

cat >"$tmp/bin/pnpm" <<'EOF'
#!/bin/sh
set -eu
printf '%s\n' "$*" >>"${PNPM_CALL_LOG:?}"
printf '{"token":"test-cloudflare-api-token"}\n'
EOF

chmod +x "$tmp/bin/docker" "$tmp/bin/pnpm"

docker_log="$tmp/docker.log"
pnpm_log="$tmp/pnpm.log"
tunnel_token="$tmp/cloudflare-tunnel-token"
api_token="$tmp/cloudflare-api-token"

run_target() {
  local target=$1
  local service=$2
  local expects_cloudflare_credentials=$3
  local builds_workspace_image=$4

  : >"$docker_log"
  : >"$pnpm_log"
  printf 'test-tunnel-token\n' >"$tunnel_token"
  rm -f "$api_token"

  PATH="$tmp/bin:$PATH" \
    DOCKER_CALL_LOG="$docker_log" \
    PNPM_CALL_LOG="$pnpm_log" \
    CLOUDFLARE_TUNNEL_TOKEN_FILE="$tunnel_token" \
    CLOUDFLARE_API_TOKEN_FILE="$api_token" \
    make -s --no-print-directory -C "$ROOT" "$target"

  local expected_up="compose -f infra/docker/compose.yaml -f infra/docker/compose.dev.yaml --profile dev --profile vpc up -d --build $service"
  if [ "$builds_workspace_image" = yes ]; then
    assert_eq "$(cat "$docker_log")" \
      "compose -f infra/docker/compose.yaml -f infra/docker/compose.dev.yaml build dapp
$expected_up"
  else
    assert_eq "$(cat "$docker_log")" "$expected_up"
  fi

  if [ "$expects_cloudflare_credentials" = yes ]; then
    assert_file_contains "$pnpm_log" \
      '--filter @services/api-gateway exec wrangler auth token --json'
    assert_file_contains "$api_token" 'test-cloudflare-api-token'
  else
    [ ! -s "$pnpm_log" ] || fail "$target unexpectedly synchronized Cloudflare credentials"
    [ ! -e "$api_token" ] || fail "$target unexpectedly created a Cloudflare API token"
  fi
}

run_target start-dapp-development dapp no no
run_target start-admin-development admin yes yes
run_target start-landing-development landing no yes
run_target start-api-gateway-development api-gateway yes yes
run_target start-admin-rpc-development admin-rpc no no
run_target start-trading-rpc-development trading-rpc no no

for target in start-admin-development start-api-gateway-development; do
  : >"$docker_log"
  : >"$pnpm_log"
  rm -f "$tunnel_token" "$api_token"

  if PATH="$tmp/bin:$PATH" \
    DOCKER_CALL_LOG="$docker_log" \
    PNPM_CALL_LOG="$pnpm_log" \
    CLOUDFLARE_TUNNEL_TOKEN_FILE="$tunnel_token" \
    CLOUDFLARE_API_TOKEN_FILE="$api_token" \
    make -s --no-print-directory -C "$ROOT" "$target" >"$tmp/make.out" 2>&1; then
    fail "$target accepted a missing Cloudflare Tunnel token"
  fi

  assert_file_contains "$tmp/make.out" 'Missing Cloudflare Tunnel token:'
  [ ! -s "$docker_log" ] || fail "$target invoked Docker without a Tunnel token"
  [ ! -s "$pnpm_log" ] || fail "$target synchronized an API token before validating the Tunnel token"
done

printf 'ok - individual development service targets\n'
