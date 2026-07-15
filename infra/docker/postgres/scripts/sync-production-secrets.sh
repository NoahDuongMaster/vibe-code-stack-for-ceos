#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

runtime_secret_id=$(require_scalar_value \
  POSTGRES_BACKUP_RUNTIME_SECRET_ID \
  "${POSTGRES_BACKUP_RUNTIME_SECRET_ID:-}")
aws_region=$(require_scalar_value AWS_REGION "${AWS_REGION:-}")
secret_dir=${POSTGRES_BACKUP_SECRET_DIR:-/run/vibe-code-stack/secrets}
postgres_user=${POSTGRES_USER:-trading_rpc}
postgres_database=${POSTGRES_DB:-trading_rpc}
response_file=$(mktemp)
generation_dir=''
temporary_link=''
published=false

cleanup() {
  rm -f -- "$response_file"
  [ -z "$temporary_link" ] || rm -f -- "$temporary_link"
  if [ "$published" != true ] && [ -n "$generation_dir" ]; then
    rm -rf -- "$generation_dir"
  fi
}
trap cleanup EXIT

umask 077
install -d -m 0700 "$secret_dir" "$secret_dir/generations"
retry_with_backoff aws secretsmanager get-secret-value \
  --region "$aws_region" \
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

generation_dir=$(mktemp -d "$secret_dir/generations/generation.XXXXXX")
chmod 0700 "$generation_dir"

write_json_secret() {
  local json_key=$1
  local output_name=$2

  jq -jer --arg key "$json_key" '.[$key]' "$response_file" \
    >"$generation_dir/$output_name"
  chmod 0600 "$generation_dir/$output_name"
}

write_scalar_secret() {
  local value=$1
  local output_name=$2

  printf '%s' "$value" >"$generation_dir/$output_name"
  chmod 0600 "$generation_dir/$output_name"
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

for generated_secret in \
  postgres-password postgres-replication-password \
  r2-pitr-access-key-id r2-pitr-secret-access-key \
  r2-archive-access-key-id r2-archive-secret-access-key \
  pgbackrest-cipher-passphrase trading-rpc-database-url; do
  [ -s "$generation_dir/$generated_secret" ] || {
    printf 'Generated secret is empty: %s\n' "$generated_secret" >&2
    exit 1
  }
done

temporary_link="$secret_dir/.current.$$.tmp"
ln -s "generations/$(basename "$generation_dir")" "$temporary_link"
if mv -Tf -- "$temporary_link" "$secret_dir/current" 2>/dev/null; then
  :
else
  mv -fh -- "$temporary_link" "$secret_dir/current"
fi
temporary_link=''
published=true
