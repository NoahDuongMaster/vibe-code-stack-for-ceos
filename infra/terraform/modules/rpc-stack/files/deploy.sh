#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -ne 1 ] || [[ "$1" == *[^a-zA-Z0-9._-]* ]]; then
  printf 'Usage: %s <immutable-image-tag>\n' "$0" >&2
  exit 64
fi

exec 9>/run/lock/vibe-rpc-deploy.lock
flock 9

image_tag=$1
readonly image_tag
# shellcheck source=/dev/null
source /etc/vibe-rpc/infra.env

runtime_dir=/run/vibe-rpc/secrets
compose_dir=/opt/vibe-rpc
install -d -o root -g root -m 0700 "$runtime_dir"
install -d -o root -g root -m 0755 "$compose_dir"

runtime_json=$(aws secretsmanager get-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$RUNTIME_SECRET_ARN" \
  --query SecretString \
  --output text)

required_json_string() {
  local document=$1
  local key=$2
  local value
  value=$(jq -er --arg key "$key" '.[$key] | select(type == "string" and length > 0)' <<<"$document") || {
    printf 'Runtime secret is missing required string key: %s\n' "$key" >&2
    exit 78
  }
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    printf 'Runtime secret key must contain exactly one line: %s\n' "$key" >&2
    exit 78
  fi
  printf '%s' "$value"
}

optional_json_string() {
  local document=$1
  local key=$2
  local value
  value=$(jq -er --arg key "$key" '.[$key] // "" | select(type == "string")' <<<"$document") || {
    printf 'Runtime secret key must be a string when present: %s\n' "$key" >&2
    exit 78
  }
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    printf 'Runtime secret key must contain at most one line: %s\n' "$key" >&2
    exit 78
  fi
  printf '%s' "$value"
}

write_secret_file() {
  local name=$1
  local value=$2
  local temporary
  temporary=$(mktemp "$runtime_dir/.${name}.XXXXXX")
  printf '%s' "$value" >"$temporary"
  chmod 0444 "$temporary"
  mv -f "$temporary" "$runtime_dir/$name"
}

postgres_password=$(required_json_string "$runtime_json" POSTGRES_PASSWORD)
encoded_user=$(jq -nr --arg value trading_rpc '$value | @uri')
encoded_password=$(jq -nr --arg value "$postgres_password" '$value | @uri')
database_url="postgresql://${encoded_user}:${encoded_password}@postgres:5432/trading_rpc"
r2_account_id=$(required_json_string "$runtime_json" R2_ACCOUNT_ID)
r2_pitr_bucket=$(required_json_string "$runtime_json" R2_PITR_BUCKET)
r2_archive_bucket=$(required_json_string "$runtime_json" R2_ARCHIVE_BUCKET)
postgres_archive_age_recipient=$(required_json_string \
  "$runtime_json" POSTGRES_ARCHIVE_AGE_RECIPIENT)

write_secret_file trading-rpc-database-url "$database_url"
write_secret_file coingecko-api-key "$(optional_json_string "$runtime_json" COINGECKO_API_KEY)"
write_secret_file trading-sentry-dsn "$(optional_json_string "$runtime_json" TRADING_RPC_SENTRY_DSN)"
write_secret_file admin-auth-email "$(required_json_string "$runtime_json" ADMIN_AUTH_EMAIL)"
write_secret_file admin-auth-password "$(required_json_string "$runtime_json" ADMIN_AUTH_PASSWORD)"
write_secret_file jwt-secret "$(required_json_string "$runtime_json" JWT_SECRET)"
write_secret_file admin-sentry-dsn "$(optional_json_string "$runtime_json" ADMIN_RPC_SENTRY_DSN)"
write_secret_file cloudflare-tunnel-token "$(required_json_string "$runtime_json" CLOUDFLARE_TUNNEL_TOKEN)"
write_secret_file postgres-password "$postgres_password"
write_secret_file postgres-replication-password "$(required_json_string "$runtime_json" POSTGRES_REPLICATION_PASSWORD)"
write_secret_file r2-pitr-access-key-id "$(required_json_string "$runtime_json" R2_PITR_ACCESS_KEY_ID)"
write_secret_file r2-pitr-secret-access-key "$(required_json_string "$runtime_json" R2_PITR_SECRET_ACCESS_KEY)"
write_secret_file r2-archive-access-key-id "$(required_json_string "$runtime_json" R2_ARCHIVE_ACCESS_KEY_ID)"
write_secret_file r2-archive-secret-access-key "$(required_json_string "$runtime_json" R2_ARCHIVE_SECRET_ACCESS_KEY)"
write_secret_file pgbackrest-cipher-passphrase "$(required_json_string "$runtime_json" PGBACKREST_CIPHER_PASSPHRASE)"

unset runtime_json postgres_password database_url encoded_password

postgres_data_root=/srv/vibe-rpc/postgres
postgres_backup_stage_root=/srv/vibe-rpc/backup-stage
postgres_restore_stage_root=/srv/vibe-rpc/restore-stage
install -d -o 70 -g 70 -m 0700 \
  "$postgres_data_root/data" \
  "$postgres_data_root/socket" \
  "$postgres_data_root/spool" \
  "$postgres_data_root/backup-state" \
  "$postgres_backup_stage_root/stage" \
  "$postgres_restore_stage_root/restores"

registry=${TRADING_RPC_REPOSITORY_URL%%/*}
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$registry" >/dev/null

images_file="$compose_dir/images.env"
rollback_images_file="$compose_dir/images.rollback.env"
temporary_images=$(mktemp "$compose_dir/.images.XXXXXX")
if [ -f "$images_file" ]; then
  cp "$images_file" "$rollback_images_file"
  chmod 0600 "$rollback_images_file"
else
  rm -f "$rollback_images_file"
fi
cat >"$temporary_images" <<EOF
DEPLOYMENT_ENVIRONMENT=$DEPLOYMENT_ENVIRONMENT
AWS_REGION=$AWS_REGION
TRADING_RPC_IMAGE=$TRADING_RPC_REPOSITORY_URL:$image_tag
ADMIN_RPC_IMAGE=$ADMIN_RPC_REPOSITORY_URL:$image_tag
POSTGRES_IMAGE=$POSTGRES_REPOSITORY_URL:$image_tag
CLOUDFLARED_IMAGE=$CLOUDFLARED_IMAGE
RUNTIME_SECRET_DIR=$runtime_dir
TRADING_RPC_LOG_GROUP=$TRADING_RPC_LOG_GROUP
ADMIN_RPC_LOG_GROUP=$ADMIN_RPC_LOG_GROUP
CLOUDFLARED_LOG_GROUP=$CLOUDFLARED_LOG_GROUP
POSTGRES_LOG_GROUP=$POSTGRES_LOG_GROUP
POSTGRES_BACKUP_LOG_GROUP=$POSTGRES_BACKUP_LOG_GROUP
DATABASE_POOL_MAX=$DATABASE_POOL_MAX
POSTGRES_DATA_DIR=$postgres_data_root/data
POSTGRES_SOCKET_DIR=$postgres_data_root/socket
PGBACKREST_SPOOL_DIR=$postgres_data_root/spool
POSTGRES_BACKUP_STATE_DIR=$postgres_data_root/backup-state
POSTGRES_BACKUP_STAGE_DIR=$postgres_backup_stage_root/stage
POSTGRES_RESTORE_STAGE_DIR=$postgres_restore_stage_root/restores
POSTGRES_BACKUP_RECOVERY_SECRET_ID=$BACKUP_RECOVERY_SECRET_ARN
POSTGRES_BACKUP_KMS_KEY_ID=$BACKUP_MANIFEST_KMS_KEY_ARN
POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS=$BACKUP_MANIFEST_KMS_KEY_ARN
R2_ACCOUNT_ID=$r2_account_id
R2_PITR_BUCKET=$r2_pitr_bucket
R2_ARCHIVE_BUCKET=$r2_archive_bucket
POSTGRES_ARCHIVE_AGE_RECIPIENT=$postgres_archive_age_recipient
EOF
chmod 0600 "$temporary_images"
mv -f "$temporary_images" "$images_file"

rollback_release() {
  local status=$?
  trap - ERR
  if [ -f "$rollback_images_file" ]; then
    printf 'Deployment failed; restoring the previous RPC release\n' >&2
    cp "$rollback_images_file" "$images_file"
    chmod 0600 "$images_file"
    docker compose \
      --project-name "vibe-rpc-$DEPLOYMENT_ENVIRONMENT" \
      --env-file "$images_file" \
      --file "$compose_dir/compose.yaml" \
      pull || true
    docker compose \
      --project-name "vibe-rpc-$DEPLOYMENT_ENVIRONMENT" \
      --env-file "$images_file" \
      --file "$compose_dir/compose.yaml" \
      up --detach --remove-orphans --wait --wait-timeout 900 || true
  fi
  exit "$status"
}
trap rollback_release ERR

docker compose \
  --project-name "vibe-rpc-$DEPLOYMENT_ENVIRONMENT" \
  --env-file "$images_file" \
  --file "$compose_dir/compose.yaml" \
  pull
docker compose \
  --project-name "vibe-rpc-$DEPLOYMENT_ENVIRONMENT" \
  --env-file "$images_file" \
  --file "$compose_dir/compose.yaml" \
  up --detach --remove-orphans --wait --wait-timeout 900

trap - ERR
rm -f "$rollback_images_file"
docker image prune --force --filter 'until=168h' >/dev/null
printf 'RPC deployment completed: environment=%s tag=%s\n' \
  "$DEPLOYMENT_ENVIRONMENT" "$image_tag"
