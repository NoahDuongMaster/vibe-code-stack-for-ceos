#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -ne 2 ]; then
  printf 'Usage: %s <staging|production> <previous-git-sha>\n' "$0" >&2
  exit 64
fi

environment=$1
image_tag=$2
if [[ "$environment" != staging && "$environment" != production ]]; then
  printf 'Unsupported rollback environment: %s\n' "$environment" >&2
  exit 64
fi
if [[ ! "$image_tag" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Rollback tag must be a full immutable Git commit SHA\n' >&2
  exit 64
fi

for name in AWS_REGION TF_STATE_BUCKET TF_STATE_KMS_KEY_ARN; do
  if [ -z "${!name:-}" ]; then
    printf 'Missing required rollback value: %s\n' "$name" >&2
    exit 78
  fi
done

terraform_directory="infra/terraform/environments/$environment"
terraform -chdir="$terraform_directory" init -input=false -reconfigure \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=rpc/$environment.tfstate" \
  -backend-config="region=$AWS_REGION" \
  -backend-config="encrypt=true" \
  -backend-config="kms_key_id=$TF_STATE_KMS_KEY_ARN" \
  -backend-config="use_lockfile=true" >/dev/null

instance_id=$(terraform -chdir="$terraform_directory" output -raw rpc_instance_id)
desired_tag_parameter=$(terraform -chdir="$terraform_directory" output -raw desired_image_tag_parameter_name)
parameters=$(jq -cn --arg command "sudo /usr/local/bin/vibe-rpc-deploy '$image_tag'" '{commands: [$command]}')
command_id=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$instance_id" \
  --document-name AWS-RunShellScript \
  --comment "Rollback $environment RPC release to $image_tag" \
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
  printf 'RPC rollback failed on %s with status %s\n' "$instance_id" "$status" >&2
  exit 70
fi

aws ssm put-parameter \
  --region "$AWS_REGION" \
  --name "$desired_tag_parameter" \
  --type String \
  --value "$image_tag" \
  --overwrite >/dev/null

printf 'RPC rollback completed: environment=%s tag=%s\n' "$environment" "$image_tag"
