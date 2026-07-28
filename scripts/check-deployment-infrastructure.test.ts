import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readRootFile = (path: string): string =>
  readFileSync(resolve(ROOT_DIR, path), 'utf8');

test('should keep RPC origins private and file-back every runtime secret', () => {
  const compose = readRootFile('infra/docker/compose.ec2.yaml');

  assert.doesNotMatch(compose, /^\s+ports:/mu);
  assert.match(compose, /^\s+postgres:/mu);
  assert.match(compose, /^\s+postgres-backup:/mu);
  assert.match(compose, /POSTGRES_BACKUP_REPOSITORY_TYPE: r2/u);
  assert.match(compose, /POSTGRES_RESTORE_STAGE_DIR/u);
  assert.match(
    compose,
    /TRADING_RPC_DATABASE_URL_SOURCE_FILE: \/run\/secrets\//u,
  );
  assert.match(compose, /ADMIN_AUTH_EMAIL_FILE: \/run\/secrets\//u);
  assert.match(compose, /ADMIN_AUTH_PASSWORD_FILE: \/run\/secrets\//u);
  assert.match(compose, /JWT_SECRET_FILE: \/run\/secrets\//u);
  assert.match(compose, /trading-rpc\.internal/u);
  assert.match(compose, /admin-rpc\.internal/u);
  assert.equal(
    (compose.match(/^\s+mem_limit:/gmu) ?? []).length,
    5,
    'every EC2 container must have an explicit memory ceiling',
  );
  assert.equal(
    (compose.match(/^\s+pids_limit:/gmu) ?? []).length,
    5,
    'every EC2 container must have an explicit PID ceiling',
  );

  for (const environment of ['staging', 'production']) {
    const environmentConfig = readRootFile(
      `infra/terraform/environments/${environment}/main.tf`,
    );
    assert.match(
      environmentConfig,
      /cloudflare\/cloudflared:[^"\n]+@sha256:[0-9a-f]{64}/u,
    );
    assert.match(environmentConfig, /root_volume_size_gib\s+=\s+30/u);
    assert.match(environmentConfig, /postgres_data_volume_size_gib\s+=\s+30/u);
    assert.match(
      environmentConfig,
      /postgres_backup_stage_volume_size_gib\s+=\s+20/u,
    );
    assert.match(
      environmentConfig,
      /postgres_restore_stage_volume_size_gib\s+=\s+30/u,
    );
    assert.match(environmentConfig, /log_retention_days\s+=\s+30/u);
  }
});

test('should provision the complete AWS and Cloudflare RPC boundary', () => {
  const terraform = readRootFile('infra/terraform/modules/rpc-stack/main.tf');
  const bootstrap = readRootFile(
    'infra/terraform/modules/rpc-stack/files/bootstrap.sh.tftpl',
  );
  const dappWrangler = readRootFile('apps/dapp/wrangler.jsonc');
  const gatewayWrangler = readRootFile('services/api-gateway/wrangler.jsonc');

  for (const resource of [
    'aws_instance',
    'aws_ebs_volume',
    'aws_ecr_repository',
    'aws_secretsmanager_secret',
    'aws_ssm_parameter',
    'cloudflare_zero_trust_tunnel_cloudflared',
    'cloudflare_connectivity_directory_service',
  ]) {
    assert.match(terraform, new RegExp(`resource "${resource}"`, 'u'));
  }

  assert.match(terraform, /http_tokens\s+=\s+"required"/u);
  assert.match(terraform, /associate_public_ip_address\s+=\s+false/u);
  assert.match(
    terraform,
    /azs\s+=\s+slice\(data\.aws_availability_zones\.available\.names, 0, 1\)/u,
  );
  assert.doesNotMatch(
    terraform.match(
      /resource "aws_security_group" "rpc_host"[\s\S]*?\n\}/u,
    )?.[0] ?? '',
    /\ningress\s*\{/u,
  );
  assert.doesNotMatch(terraform, /resource "aws_db_/u);
  assert.doesNotMatch(terraform, /resource "aws_autoscaling_group"/u);
  assert.match(terraform, /customer_master_key_spec\s+=\s+"HMAC_256"/u);
  assert.match(terraform, /prevent_destroy\s+=\s+true/u);
  assert.match(terraform, /metric_name\s+=\s+"BackupHealthy"/u);
  assert.match(terraform, /metric_name\s+=\s+"ContainersHealthy"/u);
  assert.match(terraform, /metric_name\s+=\s+"DiskUsedPercent"/u);
  assert.match(terraform, /metric_name\s+=\s+"MemoryUsedPercent"/u);
  assert.match(terraform, /aws_sns_topic_subscription/u);
  for (const gatewayName of ['ai-gateway-staging', 'api-gateway-production']) {
    assert.match(gatewayWrangler, new RegExp(`"name": "${gatewayName}"`, 'u'));
    assert.match(
      dappWrangler,
      new RegExp(`"script_name": "${gatewayName}"`, 'u'),
      `dapp login limiter must target the deployed ${gatewayName} Worker`,
    );
  }
  assert.equal(
    (dappWrangler.match(/"DAPP_LOGIN_RATE_LIMIT_MODE": "distributed"/gu) ?? [])
      .length,
    2,
    'both deployed dapp environments must use the distributed limiter',
  );

  assert.ok(
    Buffer.byteLength(bootstrap, 'utf8') < 8_192,
    'EC2 user data must retain headroom below the 16 KiB AWS limit',
  );
  assert.doesNotMatch(bootstrap, /(?:compose|deploy_script)_base64/u);
  assert.match(bootstrap, /mount_persistent_volume/u);
  assert.match(bootstrap, /RequiresMountsFor=\/srv\/vibe-rpc\/postgres/u);
  assert.match(bootstrap, /systemctl enable --now vibe-rpc\.service/u);
  assert.match(bootstrap, /systemctl enable --now vibe-rpc-monitor\.timer/u);
  assert.match(bootstrap, /swapon \/swapfile/u);
  assert.match(bootstrap, /exec \/usr\/local\/bin\/vibe-rpc-deploy/u);
});

test('should preserve the guarded RPC release path', () => {
  const terraformWorkflow = readRootFile('.github/workflows/terraform.yml');
  const deployScript = readRootFile('infra/terraform/deploy-rpc.sh');
  const rollbackScript = readRootFile('infra/terraform/rollback-rpc.sh');
  const hostDeployScript = readRootFile(
    'infra/terraform/modules/rpc-stack/files/deploy.sh',
  );

  assert.match(terraformWorkflow, /workflow_dispatch:/u);
  assert.match(terraformWorkflow, /terraform plan/u);
  assert.match(terraformWorkflow, /terraform apply/u);
  assert.match(
    terraformWorkflow,
    /if: github\.event_name == 'workflow_dispatch'/u,
  );

  assert.match(deployScript, /docker buildx build/u);
  assert.match(deployScript, /infra\/docker\/postgres\.Dockerfile/u);
  assert.match(deployScript, /ecr wait image-scan-complete/u);
  assert.match(deployScript, /secretsmanager put-secret-value/u);
  assert.match(deployScript, /ssm send-command/u);
  assert.match(deployScript, /PREVIOUS_RPC_IMAGE_TAG/u);
  assert.doesNotMatch(deployScript, /\bssh\b/u);
  assert.match(hostDeployScript, /trap rollback_release ERR/u);
  assert.match(hostDeployScript, /images\.rollback\.env/u);
  assert.match(rollbackScript, /ssm send-command/u);
  assert.match(rollbackScript, /ssm put-parameter/u);
  assert.doesNotMatch(rollbackScript, /secretsmanager put-secret-value/u);
});

test('should build every Node image from immutable inputs and the workspace lockfile', () => {
  for (const dockerfilePath of [
    'infra/docker/dapp.Dockerfile',
    'infra/docker/admin-rpc.Dockerfile',
    'infra/docker/trading-rpc.Dockerfile',
    'infra/docker/workspace-dev.Dockerfile',
  ]) {
    const dockerfile = readRootFile(dockerfilePath);
    assert.match(
      dockerfile,
      /FROM node:22-slim@sha256:[0-9a-f]{64}/u,
      `${dockerfilePath} must pin the Node base image digest`,
    );
    assert.match(
      dockerfile,
      /corepack install --global pnpm@11\.2\.2/u,
      `${dockerfilePath} must pin pnpm`,
    );
    assert.doesNotMatch(dockerfile, /pnpm install --no-frozen-lockfile/u);
  }

  for (const dockerfilePath of [
    'infra/docker/admin-rpc.Dockerfile',
    'infra/docker/trading-rpc.Dockerfile',
  ]) {
    const dockerfile = readRootFile(dockerfilePath);
    assert.match(dockerfile, /pnpm-lock\.yaml/u);
    assert.match(dockerfile, /pnpm install --frozen-lockfile --prod/u);
    assert.match(dockerfile, /--config\.node-linker=hoisted/u);
  }
});

test('should validate release Compose files without local secret env files', () => {
  const makefile = readRootFile('Makefile');
  const stagingCompose = readRootFile('infra/docker/compose.staging.yaml');
  const productionCompose = readRootFile('infra/docker/compose.prod.yaml');

  for (const variable of [
    'STAGING_DAPP_ENV_FILE',
    'STAGING_TRADING_RPC_ENV_FILE',
    'STAGING_ADMIN_RPC_ENV_FILE',
  ]) {
    assert.match(stagingCompose, new RegExp(`\\$\\{${variable}:-`, 'u'));
    assert.match(makefile, new RegExp(`${variable}=.+\\.env\\.sample`, 'u'));
  }

  for (const variable of [
    'PRODUCTION_DAPP_ENV_FILE',
    'PRODUCTION_TRADING_RPC_ENV_FILE',
    'PRODUCTION_ADMIN_RPC_ENV_FILE',
  ]) {
    assert.match(productionCompose, new RegExp(`\\$\\{${variable}:-`, 'u'));
    assert.match(makefile, new RegExp(`${variable}=.+\\.env\\.sample`, 'u'));
  }
});
