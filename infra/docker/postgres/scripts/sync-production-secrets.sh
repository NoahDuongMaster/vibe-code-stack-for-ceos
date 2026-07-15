#!/usr/bin/env bash
set -Eeuo pipefail

runtime_secret_id=${POSTGRES_BACKUP_RUNTIME_SECRET_ID:?POSTGRES_BACKUP_RUNTIME_SECRET_ID is required}
secret_dir=${POSTGRES_BACKUP_SECRET_DIR:-/run/vibe-code-stack/secrets}
postgres_user=${POSTGRES_USER:-trading_rpc}
postgres_database=${POSTGRES_DB:-trading_rpc}
response_file=$(mktemp)

cleanup() {
  rm -f -- "$response_file"
}
trap cleanup EXIT

umask 077
install -d -m 0700 "$secret_dir"
aws secretsmanager get-secret-value \
  --secret-id "$runtime_secret_id" \
  --query SecretString \
  --output text >"$response_file"

required_keys='[
  "POSTGRES_PASSWORD",
  "POSTGRES_REPLICATION_PASSWORD",
  "R2_PITR_ACCESS_KEY_ID",
  "R2_PITR_SECRET_ACCESS_KEY",
  "R2_ARCHIVE_ACCESS_KEY_ID",
  "R2_ARCHIVE_SECRET_ACCESS_KEY",
  "PGBACKREST_CIPHER_PASSPHRASE"
]'

jq -e --argjson required "$required_keys" '
  . as $document |
  type == "object" and
  all($required[];
    . as $key |
    $document[$key] | type == "string" and length > 0 and
    ((contains("\n") or contains("\r")) | not)
  )
' "$response_file" >/dev/null

write_json_secret() {
  local json_key=$1
  local output_name=$2
  local temporary_path

  temporary_path=$(mktemp "$secret_dir/.${output_name}.tmp.XXXXXX")
  jq -jer --arg key "$json_key" '.[$key]' "$response_file" >"$temporary_path"
  chmod 0600 "$temporary_path"
  mv -f -- "$temporary_path" "$secret_dir/$output_name"
}

write_scalar_secret() {
  local value=$1
  local output_name=$2
  local temporary_path

  temporary_path=$(mktemp "$secret_dir/.${output_name}.tmp.XXXXXX")
  printf '%s' "$value" >"$temporary_path"
  chmod 0600 "$temporary_path"
  mv -f -- "$temporary_path" "$secret_dir/$output_name"
}

write_json_secret POSTGRES_PASSWORD postgres-password
write_json_secret POSTGRES_REPLICATION_PASSWORD postgres-replication-password
write_json_secret R2_PITR_ACCESS_KEY_ID r2-pitr-access-key-id
write_json_secret R2_PITR_SECRET_ACCESS_KEY r2-pitr-secret-access-key
write_json_secret R2_ARCHIVE_ACCESS_KEY_ID r2-archive-access-key-id
write_json_secret R2_ARCHIVE_SECRET_ACCESS_KEY r2-archive-secret-access-key
write_json_secret PGBACKREST_CIPHER_PASSPHRASE pgbackrest-cipher-passphrase

postgres_password=$(jq -jer '.POSTGRES_PASSWORD' "$response_file")
encoded_user=$(jq -nr --arg value "$postgres_user" '$value | @uri')
encoded_password=$(jq -nr --arg value "$postgres_password" '$value | @uri')
encoded_database=$(jq -nr --arg value "$postgres_database" '$value | @uri')
write_scalar_secret \
  "postgresql://${encoded_user}:${encoded_password}@postgres:5432/${encoded_database}" \
  trading-rpc-database-url
