#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -ne 2 ]; then
  printf 'Usage: %s <staging|production> <git-sha>\n' "$0" >&2
  exit 64
fi

environment=$1
image_tag=$2
if [[ "$environment" != staging && "$environment" != production ]]; then
  printf 'Unsupported deployment environment: %s\n' "$environment" >&2
  exit 64
fi
if [[ ! "$image_tag" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Image tag must be a full immutable Git commit SHA\n' >&2
  exit 64
fi

required_environment=(
  AWS_REGION
  TF_STATE_BUCKET
  TF_STATE_KMS_KEY_ARN
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  ADMIN_AUTH_EMAIL
  ADMIN_AUTH_PASSWORD
  JWT_SECRET
  COINGECKO_API_KEY
  POSTGRES_PASSWORD
  POSTGRES_REPLICATION_PASSWORD
  R2_PITR_BUCKET
  R2_PITR_ACCESS_KEY_ID
  R2_PITR_SECRET_ACCESS_KEY
  R2_ARCHIVE_BUCKET
  R2_ARCHIVE_ACCESS_KEY_ID
  R2_ARCHIVE_SECRET_ACCESS_KEY
  PGBACKREST_CIPHER_PASSPHRASE
  POSTGRES_ARCHIVE_AGE_RECIPIENT
  POSTGRES_BACKUP_AGE_IDENTITY
)
for name in "${required_environment[@]}"; do
  if [ -z "${!name:-}" ]; then
    printf 'Missing required deployment value: %s\n' "$name" >&2
    exit 78
  fi
done
if [ "${#ADMIN_AUTH_PASSWORD}" -lt 12 ]; then
  printf 'ADMIN_AUTH_PASSWORD must contain at least 12 characters\n' >&2
  exit 78
fi
if [ "${#JWT_SECRET}" -lt 32 ]; then
  printf 'JWT_SECRET must contain at least 32 characters\n' >&2
  exit 78
fi
if [[ ! "$POSTGRES_BACKUP_AGE_IDENTITY" =~ ^AGE-SECRET-KEY-1 ]]; then
  printf 'POSTGRES_BACKUP_AGE_IDENTITY must be a valid age identity\n' >&2
  exit 78
fi
if [[ ! "$POSTGRES_ARCHIVE_AGE_RECIPIENT" =~ ^age1 ]]; then
  printf 'POSTGRES_ARCHIVE_AGE_RECIPIENT must be a valid age recipient\n' >&2
  exit 78
fi

terraform_directory="infra/terraform/environments/$environment"
terraform -chdir="$terraform_directory" init -input=false -reconfigure \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=rpc/$environment.tfstate" \
  -backend-config="region=$AWS_REGION" \
  -backend-config="encrypt=true" \
  -backend-config="kms_key_id=$TF_STATE_KMS_KEY_ARN" \
  -backend-config="use_lockfile=true" >/dev/null

terraform_output() {
  terraform -chdir="$terraform_directory" output -raw "$1"
}

admin_repository=$(terraform_output admin_rpc_repository_url)
trading_repository=$(terraform_output trading_rpc_repository_url)
postgres_repository=$(terraform_output postgres_repository_url)
instance_id=$(terraform_output rpc_instance_id)
runtime_secret_arn=$(terraform_output runtime_secret_arn)
backup_recovery_secret_arn=$(terraform_output backup_recovery_secret_arn)
desired_tag_parameter=$(terraform_output desired_image_tag_parameter_name)
tunnel_id=$(terraform_output cloudflare_tunnel_id)
trading_vpc_service_id=$(terraform_output trading_rpc_vpc_service_id)
admin_vpc_service_id=$(terraform_output admin_rpc_vpc_service_id)

previous_image_tag=$(aws ssm get-parameter \
  --region "$AWS_REGION" \
  --name "$desired_tag_parameter" \
  --query Parameter.Value \
  --output text 2>/dev/null || true)
if [[ "$previous_image_tag" =~ ^[0-9a-f]{40}$ ]] && \
  [ "$previous_image_tag" != "$image_tag" ] && [ -n "${GITHUB_ENV:-}" ]; then
  printf 'PREVIOUS_RPC_IMAGE_TAG=%s\n' "$previous_image_tag" >>"$GITHUB_ENV"
fi

registry=${trading_repository%%/*}
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$registry" >/dev/null

build_if_missing() {
  local repository_url=$1
  local dockerfile=$2
  local repository_name=${repository_url#*/}

  if aws ecr describe-images \
    --region "$AWS_REGION" \
    --repository-name "$repository_name" \
    --image-ids "imageTag=$image_tag" >/dev/null 2>&1; then
    printf 'Reusing existing immutable image: %s:%s\n' "$repository_url" "$image_tag"
    return
  fi

  docker buildx build \
    --platform linux/amd64 \
    --file "$dockerfile" \
    --tag "$repository_url:$image_tag" \
    --provenance=true \
    --sbom=true \
    --push .
}

build_if_missing "$trading_repository" infra/docker/trading-rpc.Dockerfile
build_if_missing "$admin_repository" infra/docker/admin-rpc.Dockerfile
build_if_missing "$postgres_repository" infra/docker/postgres.Dockerfile

assert_scan_clean() {
  local repository_url=$1
  local repository_name=${repository_url#*/}
  aws ecr wait image-scan-complete \
    --region "$AWS_REGION" \
    --repository-name "$repository_name" \
    --image-id "imageTag=$image_tag"
  local severe_findings
  severe_findings=$(aws ecr describe-image-scan-findings \
    --region "$AWS_REGION" \
    --repository-name "$repository_name" \
    --image-id "imageTag=$image_tag" \
    --query 'imageScanFindings.findingSeverityCounts.[CRITICAL,HIGH]' \
    --output text | awk '{ total += $1 + $2 } END { print total + 0 }')
  if [ "$severe_findings" -ne 0 ]; then
    printf 'ECR scan rejected %s:%s with %s HIGH/CRITICAL findings\n' \
      "$repository_url" "$image_tag" "$severe_findings" >&2
    exit 65
  fi
}

assert_scan_clean "$trading_repository"
assert_scan_clean "$admin_repository"
assert_scan_clean "$postgres_repository"

tunnel_response=$(curl --fail --silent --show-error \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id/token" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
tunnel_token=$(jq -er 'select(.success == true) | .result | select(type == "string" and length > 0)' <<<"$tunnel_response")
unset tunnel_response

runtime_secret=$(jq -cn \
  --arg adminEmail "$ADMIN_AUTH_EMAIL" \
  --arg adminPassword "$ADMIN_AUTH_PASSWORD" \
  --arg jwtSecret "$JWT_SECRET" \
  --arg coingeckoApiKey "$COINGECKO_API_KEY" \
  --arg adminSentryDsn "${ADMIN_RPC_SENTRY_DSN:-}" \
  --arg tradingSentryDsn "${TRADING_RPC_SENTRY_DSN:-}" \
  --arg tunnelToken "$tunnel_token" \
  --arg postgresPassword "$POSTGRES_PASSWORD" \
  --arg postgresReplicationPassword "$POSTGRES_REPLICATION_PASSWORD" \
  --arg r2AccountId "$CLOUDFLARE_ACCOUNT_ID" \
  --arg r2PitrBucket "$R2_PITR_BUCKET" \
  --arg r2PitrAccessKeyId "$R2_PITR_ACCESS_KEY_ID" \
  --arg r2PitrSecretAccessKey "$R2_PITR_SECRET_ACCESS_KEY" \
  --arg r2ArchiveBucket "$R2_ARCHIVE_BUCKET" \
  --arg r2ArchiveAccessKeyId "$R2_ARCHIVE_ACCESS_KEY_ID" \
  --arg r2ArchiveSecretAccessKey "$R2_ARCHIVE_SECRET_ACCESS_KEY" \
  --arg pgbackrestCipherPassphrase "$PGBACKREST_CIPHER_PASSPHRASE" \
  --arg postgresArchiveAgeRecipient "$POSTGRES_ARCHIVE_AGE_RECIPIENT" \
  '{
    ADMIN_AUTH_EMAIL: $adminEmail,
    ADMIN_AUTH_PASSWORD: $adminPassword,
    JWT_SECRET: $jwtSecret,
    COINGECKO_API_KEY: $coingeckoApiKey,
    ADMIN_RPC_SENTRY_DSN: $adminSentryDsn,
    TRADING_RPC_SENTRY_DSN: $tradingSentryDsn,
    CLOUDFLARE_TUNNEL_TOKEN: $tunnelToken,
    POSTGRES_PASSWORD: $postgresPassword,
    POSTGRES_REPLICATION_PASSWORD: $postgresReplicationPassword,
    R2_ACCOUNT_ID: $r2AccountId,
    R2_PITR_BUCKET: $r2PitrBucket,
    R2_PITR_ACCESS_KEY_ID: $r2PitrAccessKeyId,
    R2_PITR_SECRET_ACCESS_KEY: $r2PitrSecretAccessKey,
    R2_ARCHIVE_BUCKET: $r2ArchiveBucket,
    R2_ARCHIVE_ACCESS_KEY_ID: $r2ArchiveAccessKeyId,
    R2_ARCHIVE_SECRET_ACCESS_KEY: $r2ArchiveSecretAccessKey,
    PGBACKREST_CIPHER_PASSPHRASE: $pgbackrestCipherPassphrase,
    POSTGRES_ARCHIVE_AGE_RECIPIENT: $postgresArchiveAgeRecipient
  }')
unset tunnel_token
runtime_secret_file=$(mktemp)
trap 'rm -f "$runtime_secret_file"' EXIT
chmod 0600 "$runtime_secret_file"
printf '%s' "$runtime_secret" >"$runtime_secret_file"
unset runtime_secret
aws secretsmanager put-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$runtime_secret_arn" \
  --secret-string "file://$runtime_secret_file" >/dev/null
rm -f "$runtime_secret_file"
trap - EXIT

backup_recovery_file=$(mktemp)
trap 'rm -f "$backup_recovery_file"' EXIT
chmod 0600 "$backup_recovery_file"
printf '%s' "$POSTGRES_BACKUP_AGE_IDENTITY" >"$backup_recovery_file"
aws secretsmanager put-secret-value \
  --region "$AWS_REGION" \
  --secret-id "$backup_recovery_secret_arn" \
  --secret-string "file://$backup_recovery_file" >/dev/null
rm -f "$backup_recovery_file"
trap - EXIT

wait_for_ssm() {
  local instance_id=$1
  local ping_status
  for _ in $(seq 1 30); do
    ping_status=$(aws ssm describe-instance-information \
      --region "$AWS_REGION" \
      --filters "Key=InstanceIds,Values=$instance_id" \
      --query 'InstanceInformationList[0].PingStatus' \
      --output text 2>/dev/null || true)
    if [ "$ping_status" = Online ]; then
      return
    fi
    sleep 10
  done
  printf 'Instance did not become SSM-online: %s\n' "$instance_id" >&2
  exit 69
}

wait_for_ssm "$instance_id"
parameters=$(jq -cn --arg command "sudo /usr/local/bin/vibe-rpc-deploy '$image_tag'" '{commands: [$command]}')
command_id=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$instance_id" \
  --document-name AWS-RunShellScript \
  --comment "Deploy $environment RPC release $image_tag" \
  --parameters "$parameters" \
  --query Command.CommandId \
  --output text)
status=Pending
for _ in $(seq 1 180); do
  status=$(aws ssm get-command-invocation \
    --region "$AWS_REGION" \
    --command-id "$command_id" \
    --instance-id "$instance_id" \
    --query Status \
    --output text 2>/dev/null || true)
  case "$status" in
    Success | Cancelled | Failed | TimedOut | Cancelling) break ;;
  esac
  sleep 10
done
if [ "$status" != Success ]; then
  aws ssm get-command-invocation \
    --region "$AWS_REGION" \
    --command-id "$command_id" \
    --instance-id "$instance_id" \
    --query '{Status:Status,StandardOutput:StandardOutputContent,StandardError:StandardErrorContent}' || true
  printf 'RPC deployment failed on %s with status %s\n' "$instance_id" "$status" >&2
  exit 70
fi

aws ssm put-parameter \
  --region "$AWS_REGION" \
  --name "$desired_tag_parameter" \
  --type String \
  --value "$image_tag" \
  --overwrite >/dev/null

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    printf 'TRADING_RPC_VPC_SERVICE_ID=%s\n' "$trading_vpc_service_id"
    printf 'ADMIN_RPC_VPC_SERVICE_ID=%s\n' "$admin_vpc_service_id"
  } >>"$GITHUB_ENV"
fi

printf 'RPC release deployed through SSM: environment=%s instance=%s tag=%s\n' \
  "$environment" "$instance_id" "$image_tag"
