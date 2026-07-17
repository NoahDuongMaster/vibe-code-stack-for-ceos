#!/usr/bin/env bash
set -Eeuo pipefail

runtime_user=${TRADING_RPC_RUNTIME_USER:-trading-rpc}
runtime_uid=${TRADING_RPC_RUNTIME_UID:-1001}
runtime_gid=${TRADING_RPC_RUNTIME_GID:-1001}
runtime_secret_dir=${TRADING_RPC_RUNTIME_SECRET_DIR:-/run/trading-rpc/secrets}
runtime_dir=${TRADING_RPC_RUNTIME_DIR:-$(dirname "$runtime_secret_dir")}
database_url_source=${TRADING_RPC_DATABASE_URL_SOURCE_FILE:-}
gosu_bin=${GOSU_BIN:-/usr/local/bin/gosu}

install_runtime_dir() {
  if [ "$(id -u)" -eq 0 ]; then
    install -d -o 0 -g 0 -m 0700 "$runtime_dir" "$runtime_secret_dir"
  else
    [ "$(id -u)" = "$runtime_uid" ] && [ "$(id -g)" = "$runtime_gid" ] || {
      printf 'Trading RPC secret bootstrap must run as root\n' >&2
      exit 1
    }
    install -d -m 0700 "$runtime_dir" "$runtime_secret_dir"
  fi
}

if [ -n "$database_url_source" ]; then
  [ -r "$database_url_source" ] || {
    printf 'Trading RPC database URL secret is not readable\n' >&2
    exit 1
  }
  install_runtime_dir
  if [ "$(id -u)" -eq 0 ]; then
    install -m 0600 "$database_url_source" "$runtime_secret_dir/database-url"
    chown "$runtime_uid:$runtime_gid" "$runtime_secret_dir/database-url"
    chown "$runtime_uid:$runtime_gid" "$runtime_secret_dir" "$runtime_dir"
  else
    install -m 0600 "$database_url_source" "$runtime_secret_dir/database-url"
  fi
  export DATABASE_URL_FILE="$runtime_secret_dir/database-url"
  unset TRADING_RPC_DATABASE_URL_SOURCE_FILE
fi

exec "$gosu_bin" "$runtime_user" "$@"
