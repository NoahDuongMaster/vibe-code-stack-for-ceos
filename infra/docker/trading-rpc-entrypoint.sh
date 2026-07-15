#!/usr/bin/env bash
set -Eeuo pipefail

runtime_user=${TRADING_RPC_RUNTIME_USER:-apinode}
runtime_uid=${TRADING_RPC_RUNTIME_UID:-1001}
runtime_gid=${TRADING_RPC_RUNTIME_GID:-1001}
runtime_secret_dir=${TRADING_RPC_RUNTIME_SECRET_DIR:-/run/trading-rpc/secrets}
database_url_source=${TRADING_RPC_DATABASE_URL_SOURCE_FILE:-}
gosu_bin=${GOSU_BIN:-/usr/local/bin/gosu}

install_runtime_dir() {
  if [ "$(id -u)" -eq 0 ]; then
    install -d -o "$runtime_uid" -g "$runtime_gid" -m 0700 "$runtime_secret_dir"
  else
    [ "$(id -u)" = "$runtime_uid" ] && [ "$(id -g)" = "$runtime_gid" ] || {
      printf 'Trading RPC secret bootstrap must run as root\n' >&2
      exit 1
    }
    install -d -m 0700 "$runtime_secret_dir"
  fi
}

if [ -n "$database_url_source" ]; then
  [ -r "$database_url_source" ] || {
    printf 'Trading RPC database URL secret is not readable\n' >&2
    exit 1
  }
  install_runtime_dir
  if [ "$(id -u)" -eq 0 ]; then
    install -o "$runtime_uid" -g "$runtime_gid" -m 0600 \
      "$database_url_source" "$runtime_secret_dir/database-url"
  else
    install -m 0600 "$database_url_source" "$runtime_secret_dir/database-url"
  fi
  export DATABASE_URL_FILE="$runtime_secret_dir/database-url"
  unset TRADING_RPC_DATABASE_URL_SOURCE_FILE
fi

exec "$gosu_bin" "$runtime_user" "$@"
