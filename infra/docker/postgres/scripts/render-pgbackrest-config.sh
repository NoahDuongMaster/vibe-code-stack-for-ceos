#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

render_pgbackrest_config() {
  local output_path=$1
  local repository_type
  local temporary_path
  local postgres_user
  local postgres_database
  local account_id
  local bucket
  local access_key_id
  local secret_access_key
  local cipher_passphrase

  repository_type=$(require_scalar_value POSTGRES_BACKUP_REPOSITORY_TYPE "${POSTGRES_BACKUP_REPOSITORY_TYPE:-}") || return $?
  postgres_user=$(require_scalar_value POSTGRES_USER "${POSTGRES_USER:-trading_rpc}") || return $?
  postgres_database=$(require_scalar_value POSTGRES_DB "${POSTGRES_DB:-trading_rpc}") || return $?

  case "$repository_type" in
    r2)
      account_id=$(require_scalar_value R2_ACCOUNT_ID "${R2_ACCOUNT_ID:-}") || return $?
      bucket=$(require_scalar_value R2_PITR_BUCKET "${R2_PITR_BUCKET:-}") || return $?
      access_key_id=$(require_scalar_file R2_PITR_ACCESS_KEY_ID "${R2_PITR_ACCESS_KEY_ID_FILE:-}") || return $?
      secret_access_key=$(require_scalar_file R2_PITR_SECRET_ACCESS_KEY "${R2_PITR_SECRET_ACCESS_KEY_FILE:-}") || return $?
      cipher_passphrase=$(require_scalar_file PGBACKREST_CIPHER_PASSPHRASE "${PGBACKREST_CIPHER_PASSPHRASE_FILE:-}") || return $?
      ;;
    posix) ;;
    *)
      printf 'Unsupported POSTGRES_BACKUP_REPOSITORY_TYPE: %s\n' "$repository_type" >&2
      return 1
      ;;
  esac

  umask 077
  temporary_path=$(mktemp "${output_path}.tmp.XXXXXX")

  cat >"$temporary_path" <<EOF
[trading-rpc]
pg1-path=/var/lib/postgresql/18/docker
pg1-socket-path=/var/run/postgresql
pg1-port=5432
pg1-user=${postgres_user}
pg1-database=${postgres_database}

[global]
EOF

  case "$repository_type" in
    r2)
      cat >>"$temporary_path" <<EOF
repo1-type=s3
repo1-path=/production
repo1-s3-bucket=${bucket}
repo1-s3-endpoint=${account_id}.r2.cloudflarestorage.com
repo1-s3-region=auto
repo1-s3-uri-style=path
repo1-s3-key=${access_key_id}
repo1-s3-key-secret=${secret_access_key}
repo1-storage-verify-tls=y
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=${cipher_passphrase}
EOF
      ;;
    posix)
      cat >>"$temporary_path" <<'EOF'
repo1-type=posix
repo1-path=/var/lib/pgbackrest/repo
EOF
      ;;
  esac

  cat >>"$temporary_path" <<'EOF'
repo1-retention-full-type=time
repo1-retention-full=35
repo1-bundle=y
repo1-block=y
archive-async=y
spool-path=/var/spool/pgbackrest
compress-type=zst
process-max=2
start-fast=y
EOF

  chmod 0600 "$temporary_path"
  mv -f -- "$temporary_path" "$output_path"
}
