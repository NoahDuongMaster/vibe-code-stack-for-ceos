#!/usr/bin/env bash
set -Eeuo pipefail

runtime_user=${POSTGRES_RUNTIME_USER:-postgres}
runtime_uid=${POSTGRES_RUNTIME_UID:-70}
runtime_gid=${POSTGRES_RUNTIME_GID:-70}
runtime_secret_dir=${POSTGRES_BACKUP_RUNTIME_SECRET_DIR:-/run/postgres-backup-secrets}
gosu_bin=${GOSU_BIN:-/usr/local/bin/gosu}
setpriv_bin=${BACKUP_SETPRIV_BIN:-setpriv}
backup_entrypoint=${POSTGRES_BACKUP_ENTRYPOINT:-/usr/local/bin/postgres-backup/backup-entrypoint.sh}
render_crontab_bin=${BACKUP_RENDER_CRONTAB_BIN:-/usr/local/bin/postgres-backup/render-backup-crontab.sh}
crontab_dir=${POSTGRES_BACKUP_CRONTAB_DIR:-/run/postgres-backup-cron}
crontab_file=$runtime_user
crond_bin=${BACKUP_CROND_BIN:-crond}

install_runtime_dir() {
  if [ "$(id -u)" -eq 0 ]; then
    install -d -o 0 -g 0 -m 0700 "$runtime_secret_dir"
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
    install -m 0600 "$source_path" "$target_path"
    chown "$runtime_uid:$runtime_gid" "$target_path"
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
  if [ "$(id -u)" -eq 0 ]; then
    chown "$runtime_uid:$runtime_gid" "$runtime_secret_dir"
  fi
fi

if [ "${POSTGRES_BACKUP_MODE:-disabled}" = enabled ] && \
  [ "${1:-}" = "$backup_entrypoint" ]; then
  [ "$#" -eq 1 ] || {
    printf 'PostgreSQL backup scheduler accepts no command arguments\n' >&2
    exit 64
  }
  [ "$(id -u)" -eq 0 ] || {
    printf 'PostgreSQL backup scheduler bootstrap must run as root\n' >&2
    exit 1
  }
  install -d -o 0 -g "$runtime_gid" -m 0750 "$crontab_dir"
  "$render_crontab_bin" "$crontab_dir/$crontab_file"
  chown 0:"$runtime_gid" "$crontab_dir" "$crontab_dir/$crontab_file"
  chmod 0750 "$crontab_dir"
  chmod 0640 "$crontab_dir/$crontab_file"
  "$gosu_bin" "$runtime_user" "$backup_entrypoint" --prepare-only
  export TZ=UTC
  exec "$setpriv_bin" \
    --reuid="$runtime_uid" \
    --regid="$runtime_gid" \
    --init-groups \
    --inh-caps=-all,+setgid \
    --ambient-caps=-all,+setgid \
    --no-new-privs \
    -- "$crond_bin" -f -c "$crontab_dir"
fi

exec "$gosu_bin" "$runtime_user" "$@"
