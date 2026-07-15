#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
compose=(docker compose \
  -f "$ROOT/infra/docker/compose.yaml" \
  -f "$ROOT/infra/docker/compose.dev.yaml")
project="task2-postgres-reachability-$$"
host_port=$(node -e 'const net=require("node:net"); const s=net.createServer(); s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')

cleanup() {
  POSTGRES_HOST_PORT="$host_port" "${compose[@]}" -p "$project" \
    --profile dev --profile vpc down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

dev_json=$(POSTGRES_HOST_PORT="$host_port" "${compose[@]}" \
  --profile dev --profile vpc config --no-env-resolution --format json)
printf '%s' "$dev_json" | jq -e '
  .networks["postgres-development-host"].internal != true and
  (.services.postgres.networks | has("postgres-development-host"))
' >/dev/null

POSTGRES_HOST_PORT="$host_port" "${compose[@]}" -p "$project" \
  --profile dev --profile vpc up -d --build postgres >/dev/null

for attempt in $(seq 1 60); do
  if PORT="$host_port" node -e '
    const net=require("node:net");
    const socket=net.createConnection({host:"127.0.0.1",port:Number(process.env.PORT)});
    socket.setTimeout(500);
    socket.once("connect",()=>{socket.destroy();process.exit(0)});
    socket.once("timeout",()=>{socket.destroy();process.exit(1)});
    socket.once("error",()=>process.exit(1));
  '; then
    printf 'ok - development PostgreSQL loopback reachability\n'
    exit 0
  fi
  sleep 1
done

printf 'Development PostgreSQL did not accept loopback TCP connections\n' >&2
exit 1
