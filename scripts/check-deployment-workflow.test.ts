import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readRootFile = (path: string): string =>
  readFileSync(resolve(ROOT_DIR, path), 'utf8');
const countLines = (value: string): number =>
  value.trimEnd().split(/\r?\n/u).length;

test('should keep every GitHub workflow and action below 300 lines', () => {
  const workflowDirectory = resolve(ROOT_DIR, '.github/workflows');

  for (const filename of readdirSync(workflowDirectory)) {
    if (!filename.endsWith('.yml') && !filename.endsWith('.yaml')) {
      continue;
    }

    const workflow = readRootFile(`.github/workflows/${filename}`);
    assert.ok(
      countLines(workflow) <= 300,
      `${filename} must remain at or below 300 lines`,
    );
  }

  for (const directory of readdirSync(resolve(ROOT_DIR, '.github/actions'))) {
    const action = readRootFile(`.github/actions/${directory}/action.yml`);
    assert.ok(
      countLines(action) <= 300,
      `${directory}/action.yml must remain at or below 300 lines`,
    );
  }
});

test('should deploy only landing through the shared environment-aware action', () => {
  const deployWorkflow = readRootFile('.github/workflows/deploy.yml');
  const deployLandingAction = readRootFile(
    '.github/actions/deploy-landing/action.yml',
  );
  const landingWrangler = readRootFile('apps/landing/wrangler.jsonc');

  assert.doesNotMatch(deployWorkflow, /^\s+id-token: write$/mu);
  assert.equal(
    (deployWorkflow.match(/FULL_STACK_DEPLOY_ENABLED: 'false'/gu) ?? []).length,
    1,
  );
  assert.ok(
    countLines(deployLandingAction) <= 300,
    'the landing deployment action must remain at or below 300 lines',
  );
  assert.equal(
    (
      deployWorkflow.match(/uses: \.\/\.github\/actions\/deploy-landing/gu) ??
      []
    ).length,
    1,
  );
  for (const step of [
    'Build landing',
    'Capture current landing deployment',
    'Deploy landing',
    'Smoke-test landing',
  ]) {
    assert.equal(
      (deployLandingAction.match(new RegExp(`- name: ${step}`, 'gu')) ?? [])
        .length,
      1,
    );
  }
  assert.match(deployLandingAction, /WRANGLER_OUTPUT_FILE_PATH=/u);
  assert.match(
    deployLandingAction,
    /jq -e 'select\(\.type == "deploy"\)' "\$output_file"/u,
  );
  assert.doesNotMatch(deployLandingAction, /LANDING_DEPLOYMENT_URL/u);
  assert.match(
    deployLandingAction,
    /wrangler rollback\n\s+"\$PREVIOUS_LANDING_VERSION_ID" --env "\$DEPLOY_ENVIRONMENT"/u,
  );
  assert.match(
    deployLandingAction,
    /--message "Automatic rollback after failed release" --yes/u,
  );
  assert.match(
    deployLandingAction,
    /PUBLIC_SITE_URL must be a public HTTPS origin without a path, query, or fragment/u,
  );
  assert.match(deployLandingAction, /--retry 24 --retry-delay 5/u);
  assert.match(deployLandingAction, /echo "Smoke-testing \$landing_origin\/"/u);
  assert.match(
    deployLandingAction,
    /Landing canonical URL does not match PUBLIC_SITE_URL/u,
  );
  assert.match(
    deployLandingAction,
    /Sitemap: \$landing_origin\/sitemap-index\.xml/u,
  );
  assert.match(
    landingWrangler,
    /"production":\s*\{[\s\S]*?"workers_dev": false,[\s\S]*?"preview_urls": false,[\s\S]*?"pattern": "vibe-code-stack-for-ceos\.duongnamtruong\.com",[\s\S]*?"custom_domain": true/u,
  );
});

test('should keep the inactive full-stack path guarded and environment-aware', () => {
  const deployWorkflow = readRootFile('.github/workflows/deploy.yml');
  const deployFullStackAction = readRootFile(
    '.github/actions/deploy-full-stack/action.yml',
  );

  assert.match(
    deployWorkflow,
    /- name: Deploy full stack\n\s+if: env\.FULL_STACK_DEPLOY_ENABLED == 'true'\n\s+uses: \.\/\.github\/actions\/deploy-full-stack/u,
  );
  assert.match(
    deployFullStackAction,
    /- name: Authenticate to AWS with GitHub OIDC\n\s+uses: aws-actions\/configure-aws-credentials@[0-9a-f]{40}/u,
  );
  assert.match(
    deployFullStackAction,
    /run: infra\/terraform\/deploy-rpc\.sh "\$DEPLOY_ENVIRONMENT" "\$DEPLOY_COMMIT_SHA"/u,
  );
  assert.doesNotMatch(
    `${deployWorkflow}\n${deployFullStackAction}`,
    /vars\.(?:TRADING|ADMIN)_RPC_VPC_SERVICE_ID/u,
  );
});
