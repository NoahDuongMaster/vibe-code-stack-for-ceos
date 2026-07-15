#!/usr/bin/env bash
set -Eeuo pipefail

runtime_user=${POSTGRES_RUNTIME_USER:-postgres}
runtime_uid=${POSTGRES_RUNTIME_UID:-70}
runtime_gid=${POSTGRES_RUNTIME_GID:-70}
runtime_secret_dir=${POSTGRES_BACKUP_RUNTIME_SECRET_DIR:-/run/postgres-backup-secrets}
gosu_bin=${GOSU_BIN:-/usr/local/bin/gosu}

install_runtime_dir() {
  if [ "$(id -u)" -eq 0 ]; then
    install -d -o "$runtime_uid" -g "$runtime_gid" -m 0700 "$runtime_secret_dir"
  else
    [ "$(id -u)" = "$runtime_uid" ] && [ "$(id -g)" = "$runtime_gid" ] || {
      printf 'PostgreSQL backup secret bootstrap must run as root\n' >&2
      exit 1
    }
    install -d -m 0700 "$runtime_secret_dir"
  fi
}

copy_runtime_secret() {
  local source_variable=$1
  local target_variable=$2
  local output_name=$3
  local source_path=${!source_variable:-}
  local target_path="$runtime_secret_dir/$output_name"

  [ -r "$source_path" ] || {
    printf 'Required PostgreSQL backup secret is not readable: %s\n' \
      "$source_variable" >&2
    exit 1
  }
  if [ "$(id -u)" -eq 0 ]; then
    install -o "$runtime_uid" -g "$runtime_gid" -m 0600 \
      "$source_path" "$target_path"
  else
    install -m 0600 "$source_path" "$target_path"
  fi
  printf -v "$target_variable" '%s' "$target_path"
  export "$target_variable"
  unset "$source_variable"
}

if [ "${POSTGRES_BACKUP_MODE:-disabled}" = enabled ]; then
  install_runtime_dir
  copy_runtime_secret \
    POSTGRES_REPLICATION_PASSWORD_SOURCE_FILE \
    POSTGRES_REPLICATION_PASSWORD_FILE postgres-replication-password
  copy_runtime_secret \
    R2_PITR_ACCESS_KEY_ID_SOURCE_FILE \
    R2_PITR_ACCESS_KEY_ID_FILE r2-pitr-access-key-id
  copy_runtime_secret \
    R2_PITR_SECRET_ACCESS_KEY_SOURCE_FILE \
    R2_PITR_SECRET_ACCESS_KEY_FILE r2-pitr-secret-access-key
  copy_runtime_secret \
    R2_ARCHIVE_ACCESS_KEY_ID_SOURCE_FILE \
    R2_ARCHIVE_ACCESS_KEY_ID_FILE r2-archive-access-key-id
  copy_runtime_secret \
    R2_ARCHIVE_SECRET_ACCESS_KEY_SOURCE_FILE \
    R2_ARCHIVE_SECRET_ACCESS_KEY_FILE r2-archive-secret-access-key
  copy_runtime_secret \
    PGBACKREST_CIPHER_PASSPHRASE_SOURCE_FILE \
    PGBACKREST_CIPHER_PASSPHRASE_FILE pgbackrest-cipher-passphrase
fi

exec "$gosu_bin" "$runtime_user" "$@"
