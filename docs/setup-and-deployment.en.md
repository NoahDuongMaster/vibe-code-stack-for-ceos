# Environment Setup and Deployment Guide

**English** · [Tiếng Việt](./setup-and-deployment.md)

This is the step-by-step runbook for new project members. Run commands from the
repository root unless a section says otherwise.

Configuration sources of truth:

- Toolchain and operational commands: [`mise.toml`](../mise.toml)
- Local environment templates: [`.env.sample`](../.env.sample) and the
  workspace-level `*.sample` files
- Cloudflare deployment: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
- AWS/Cloudflare infrastructure: [`infra/terraform/README.md`](../infra/terraform/README.md)
- Cloudflare resources and bindings: each workspace's `wrangler.jsonc`
- Docker and database recovery: [`infra/docker/README.md`](../infra/docker/README.md)

> Never run `wrangler deploy` or an equivalent deployment command from a local
> machine. Staging and production are deployed only by GitHub Actions after CI
> succeeds.

## 1. What does each environment deploy?

| Environment | Start/deploy method | Components | Notes |
| --- | --- | --- | --- |
| Local native | `mise run dev` | 3 frontends, 3 backends, PostgreSQL, and VPC origins | Hot reload; the gateway requires Cloudflare login and a Tunnel token |
| Local Docker | `mise run docker:start` | Full development stack in containers | Uses the development VPC topology |
| Staging | Push/merge to `develop` | 4 Cloudflare targets + RPC/PostgreSQL on EC2 | Runs only after CI succeeds |
| Production | Push/merge to `main` | 4 Cloudflare targets + RPC/PostgreSQL on EC2 | Requires GitHub Environment approval |

Both RPC services and PostgreSQL 18/pgBackRest run as Docker containers on one
fixed private EC2 instance per environment. Terraform provisions ECR,
encrypted EBS, Secrets Manager, KMS, the Cloudflare Tunnel, and both Workers
VPC Services. GitHub Actions deploys through SSM without SSH or public
RPC/database ports.

## 2. Set up local native development on a new machine

### Step 1: Install prerequisites

You need:

- Git
- [mise](https://mise.jdx.dev/installing-mise.html)
- Docker Engine with Docker Compose, or Docker Desktop/OrbStack
- Access to the project's Cloudflare account when running the gateway or full
  stack

Do not install Node.js or pnpm manually. Mise installs the exact versions locked
by the repository.

### Step 2: Clone and install dependencies

```bash
git clone https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos.git
cd vibe-code-stack-for-ceos
mise run setup
mise run toolchain:check
```

### Step 3: Create every local environment file

Run these copy commands only on a fresh clone. Do not overwrite an existing
`.env` file that may contain machine-specific secrets or overrides.

```bash
cp .env.sample .env
cp apps/dapp/.env.sample apps/dapp/.env
cp apps/dapp/.dev.vars.sample apps/dapp/.dev.vars
cp apps/admin/.env.sample apps/admin/.env
cp apps/landing/.env.sample apps/landing/.env
cp services/trading-rpc/.env.sample services/trading-rpc/.env
cp services/admin-rpc/.env.sample services/admin-rpc/.env
cp services/api-gateway/.dev.vars.sample services/api-gateway/.dev.vars
```

The committed samples contain all values required for local startup. These
values are optional:

- Set `COINGECKO_API_KEY` in `services/trading-rpc/.env` for more reliable live
  market data.
- Set Sentry DSNs only when testing error monitoring. Empty values disable
  Sentry.
- The gateway and admin-rpc samples share one local `JWT_SECRET` so login works
  end to end; always replace it with an environment-specific secret outside dev.

Default local ports:

| Component | Port |
| --- | ---: |
| dapp | `46000` |
| admin | `46001` |
| landing | `46002` |
| api-gateway | `46003` |
| trading-rpc Connect / gRPC | `46004` / `46005` |
| admin-rpc Connect / gRPC | `46006` / `46007` |
| PostgreSQL | `46008` |
| dapp / gateway inspector | `46009` / `46010` |
| Docker VPC origins | `46104`–`46107` |

If a port is occupied, change Docker host ports in the root `.env`. Native
frontend and RPC ports live in their workspace config or environment file. Dev
servers use `strictPort`, so a collision fails clearly instead of silently
selecting another port.

### Step 4: Set up Cloudflare development access

Skip this step when running only a frontend, PostgreSQL, or a native RPC
service. The full stack and gateway require remote Workers VPC bindings.

Log in to Wrangler once:

```bash
pnpm --filter @services/api-gateway exec wrangler login
```

Obtain the rotated development Tunnel token from a Cloudflare administrator.
Write it through an editor so it does not appear in shell history:

```bash
mkdir -p infra/docker/secrets
install -m 600 /dev/null infra/docker/secrets/cloudflare-tunnel-token
${EDITOR:-vi} infra/docker/secrets/cloudflare-tunnel-token
chmod 600 infra/docker/secrets/cloudflare-tunnel-token
```

The development Cloudflare account must have two VPC Services through the same
Tunnel:

- Binding `TRADING_RPC` → HTTP `trading-rpc.internal:3001`
- Binding `ADMIN_RPC` → HTTP `admin-rpc.internal:3001`

Development service IDs are configured in
[`services/api-gateway/wrangler.jsonc`](../services/api-gateway/wrangler.jsonc).
Never reuse one origin's service ID for the other origin.

### Step 5: Validate and start

```bash
mise run docker:check
mise run dev
```

To run only part of the stack:

```bash
mise run dev:web
mise run dev:admin
mise run dev:landing
mise run dev:api
mise run dev:admin-api
mise run dev:gateway
mise run dev:backend
```

`dev:api` starts PostgreSQL automatically. `dev:gateway` and `dev` start the VPC
origins, but still require Wrangler authentication and the Tunnel token from
step 4.

### Step 6: Smoke test

```bash
curl --fail http://127.0.0.1:46003/healthz
curl --fail http://127.0.0.1:46004/healthz
curl --fail http://127.0.0.1:46006/healthz

curl --fail -X POST \
  http://127.0.0.1:46003/trading.v1.TradingService/GetMarkets \
  -H 'content-type: application/json' \
  -H 'connect-protocol-version: 1' \
  --data '{"coinIds":["bitcoin","ethereum"],"vsCurrency":"usd"}'
```

Open the frontends:

- dapp: `http://localhost:46000`
- admin: `http://localhost:46001`
- landing: `http://localhost:46002`

### Step 7: Stop local infrastructure

```bash
mise run dev:infra:stop
```

## 3. Set up the full local Docker stack

Complete the clone, environment, and Cloudflare development access steps in
section 2, then run:

```bash
mise run docker:check
mise run docker:start
```

Inspect status and logs:

```bash
docker compose \
  -f infra/docker/compose.yaml \
  -f infra/docker/compose.dev.yaml \
  --profile dev --profile vpc ps
make logs-development
```

Stop and remove development containers and networks while preserving the named
database volume:

```bash
mise run docker:stop
```

Delete the `postgres-data` volume only when you explicitly intend to erase the
entire local database. Volume deletion is not a normal setup step.

## 4. Provision shared staging and production infrastructure

These are one-time administrator tasks. Every environment must use separate
resources, URLs, secrets, and VPC Service IDs.

### Step 1: Bootstrap and apply Terraform

Perform the one-time AWS root-of-trust bootstrap (S3 state bucket, GitHub OIDC
provider, and Terraform execution role), then configure the GitHub Environment
values in [`infra/terraform/README.md`](../infra/terraform/README.md). Never run
`terraform apply` locally.

In **Actions → Terraform → Run workflow**:

1. Run `staging` + `apply`, approve the plan job, inspect its rendered plan and
   artifact, then separately approve the apply job. Staging apply accepts only
   `develop`; production apply accepts only `main`.
2. Copy `github_deploy_role_arn` to the staging
   `AWS_RPC_DEPLOY_ROLE_ARN` Environment variable.
3. Confirm the SNS email sent to `OPERATIONS_ALERT_EMAIL`.
4. Repeat for production behind Required reviewers.

Terraform creates private EC2, three protected encrypted EBS volumes, ECR,
KMS, Secrets Manager, CloudWatch, the Tunnel, and VPC Services. Docker
PostgreSQL reuses the complete existing pgBackRest/R2 backup and restore-drill
design; AWS RDS is not created. Secret values never enter state.

### Step 2: Provision Cloudflare resources

In the Cloudflare account:

1. Create or verify two Pages projects, `ai-first-admin-staging` and
   `ai-first-admin`, both with `main` as their production branch. Separate
   projects give both environments an independent rollback API.
2. Grant the API token Tunnel, Connectivity Directory/VPC Service, Worker, and
   Pages permissions. Terraform creates the Tunnel and VPC Services.
3. Set environment `CORS_ORIGINS` to the real dapp and admin origins. Do not
   leave it empty, and do not use a wildcard in production.
4. Create private PITR and archive R2 buckets, then configure Bucket Lock and
   lifecycle rules exactly as documented in
   [`infra/docker/README.md`](../infra/docker/README.md).

Worker names are managed in source:

| Target | Staging | Production |
| --- | --- | --- |
| dapp | `ai-first-dapp-staging` | `ai-first-dapp` |
| admin Pages | project `ai-first-admin-staging`, branch `main` | project `ai-first-admin`, branch `main` |
| landing | `ai-first-landing-staging` | `ai-first-landing` |
| gateway | `ai-gateway-staging` | `api-gateway-production` |

### Step 3: Create GitHub Environments

In GitHub, open **Settings → Environments** and create `staging` and
`production`. Enable **Required reviewers** for `production`.

Add these secrets to each environment:

| Secret | Required | Notes |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | Deploy token scoped to the required account and resources |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | The workflow currently reads it as a secret |
| `SESSION_SECRET` | Yes | At least 32 characters; different from the sample and from the other environment |
| `DEMO_AUTH_EMAIL` | Yes | Credential for the current reference dapp auth flow |
| `DEMO_AUTH_PASSWORD` | Yes | Never use a local placeholder |
| `ADMIN_AUTH_EMAIL` | Yes | admin-rpc login identity |
| `ADMIN_AUTH_PASSWORD` | Yes | At least 12 characters |
| `JWT_SECRET` | Yes | At least 32 characters; shared by admin-rpc and gateway per environment |
| `COINGECKO_API_KEY` | Yes | Live market-data provider key |
| `POSTGRES_PASSWORD` | Yes | Docker PostgreSQL application-owner password |
| `POSTGRES_REPLICATION_PASSWORD` | Yes | Dedicated pgBackRest replication-role password |
| `R2_PITR_ACCESS_KEY_ID` | Yes | Access key scoped only to the PITR bucket |
| `R2_PITR_SECRET_ACCESS_KEY` | Yes | Matching PITR bucket secret |
| `R2_ARCHIVE_ACCESS_KEY_ID` | Yes | Access key scoped only to the archive bucket |
| `R2_ARCHIVE_SECRET_ACCESS_KEY` | Yes | Matching archive bucket secret |
| `PGBACKREST_CIPHER_PASSPHRASE` | Yes | Encrypts the pgBackRest repository |
| `POSTGRES_BACKUP_AGE_IDENTITY` | Yes | Private age identity with offline escrow copies |
| `ADMIN_RPC_SENTRY_DSN` | No | admin-rpc telemetry |
| `TRADING_RPC_SENTRY_DSN` | No | trading-rpc telemetry |
| `SENTRY_AUTH_TOKEN` | No | Required only for source-map uploads |

Add these variables to each environment:

| Variable | Staging example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_PROJECT_NAME` | `vibe-code-stack-for-ceos` | dapp display name |
| `NEXT_PUBLIC_API_ENDPOINT` | `https://<staging-gateway>` | Gateway URL for this environment |
| `NEXT_PUBLIC_BASE_URL` | `https://<staging-dapp>` | Public dapp origin |
| `ADMIN_PUBLIC_URL` | `https://<staging-admin>` | Public admin origin used by release smoke tests |
| `PUBLIC_API_URL` | `https://<staging-gateway>` | Gateway URL built into admin |
| `PUBLIC_SITE_URL` | `https://<staging-landing>` | Canonical landing origin |
| `NEXT_PUBLIC_SENTRY_DSN` | empty or a DSN | dapp runtime monitoring |
| `PUBLIC_SENTRY_DSN` | empty or a DSN | Shared by admin and landing in the current workflow |
| `GATEWAY_CORS_ORIGINS` | `https://<admin>,https://<dapp>` | Explicit allow-list; `*` is rejected |
| `AWS_REGION` | `ap-southeast-1` | Terraform and RPC runtime region |
| `AWS_TERRAFORM_ROLE_ARN` | IAM role ARN | OIDC role for plan/apply |
| `AWS_GITHUB_OIDC_PROVIDER_ARN` | IAM provider ARN | Account-level root of trust |
| `AWS_RPC_DEPLOY_ROLE_ARN` | Terraform output | OIDC role for ECR and SSM rollout |
| `OPERATIONS_ALERT_EMAIL` | `on-call@example.com` | Alarm destination; confirm its SNS subscription |
| `TF_STATE_BUCKET` | S3 bucket name | Encrypted/versioned state bucket |
| `TF_STATE_KMS_KEY_ARN` | KMS key ARN | Customer-managed key encrypting Terraform state |
| `R2_PITR_BUCKET` | `<project>-postgres-pitr` | Private WAL/PITR bucket |
| `R2_ARCHIVE_BUCKET` | `<project>-postgres-archive` | Private monthly-archive bucket |
| `POSTGRES_ARCHIVE_AGE_RECIPIENT` | `age1...` | Public recipient used to encrypt monthly archives |
| `SENTRY_ORG` | empty or an org | Use with `SENTRY_PROJECT` and the auth token |
| `SENTRY_PROJECT` | empty or a project | Enables dapp Sentry source-map uploads |

Never put a secret in `wrangler.jsonc` or in an unencrypted GitHub variable.

### Step 4: Provision Worker runtime secrets

GitHub build secrets do not automatically become Cloudflare Worker runtime
bindings. An authorized operator must provision dapp secrets once per
environment:

```bash
pnpm --filter @apps/dapp exec wrangler secret put SESSION_SECRET --env staging
pnpm --filter @apps/dapp exec wrangler secret put DEMO_AUTH_EMAIL --env staging
pnpm --filter @apps/dapp exec wrangler secret put DEMO_AUTH_PASSWORD --env staging
```

Replace `staging` with `production` when provisioning production. Wrangler
prompts for each value; never include secret values directly in command-line
arguments.

Gateway JWT authentication is mandatory in staging and production. Deployment
CI writes the same GitHub Environment `JWT_SECRET` to Secrets Manager for
admin-rpc and to the gateway Wrangler secret.

## 5. Deploy staging

### Required preflight

- The staging backend and Tunnel are healthy.
- Staging Terraform has been applied and `AWS_RPC_DEPLOY_ROLE_ARN` is configured.
- `env.staging.vars.CORS_ORIGINS` contains the real staging dapp/admin origins.
- The `staging` GitHub Environment contains every required secret and variable.
- Dapp runtime secrets have been provisioned.
- `mise run verify` passes on the branch being merged.

### Deployment steps

1. Open a pull request into `develop`.
2. Wait for the entire **CI** workflow to succeed.
3. Merge the pull request into `develop`.
4. CI runs again on the merged commit.
5. The **Deploy** workflow receives the successful commit and starts
   **Deploy (staging)**.
6. If a job fails, fix the cause and send it through Git and CI again. Do not
   deploy manually.

The staging workflow builds and deploys in this order:

1. Both RPC images plus PostgreSQL/pgBackRest → ECR scan → private EC2 through SSM.
2. Gateway config receives VPC Service IDs from Terraform state and syncs JWT.
3. gateway → Worker `ai-gateway-staging`, so the shared Durable Object is
   available before dapp traffic moves.
4. dapp → Worker `ai-first-dapp-staging`.
5. landing → Worker `ai-first-landing-staging`.
6. admin → the separate Pages project `ai-first-admin-staging`, branch `main`.
7. The workflow smoke-tests the frontends, dapp session, gateway,
   TradingService, AdminService, and the first coin image URL. A failed rollout
   or smoke test triggers automatic rollback.

### Verify staging

Replace placeholders with the configured staging URLs:

```bash
curl --fail https://<staging-gateway>/healthz
curl --fail -X POST \
  https://<staging-gateway>/trading.v1.TradingService/GetMarkets \
  -H 'content-type: application/json' \
  -H 'connect-protocol-version: 1' \
  --data '{"coinIds":["bitcoin","ethereum"],"vsCurrency":"usd"}'
```

Then verify dapp, admin, landing, login, live market data, CORS, and Cloudflare
logs/traces. The workflow already exercises AdminService through the gateway;
repeat it manually only when investigating a release.

## 6. Deploy production

### Required preflight

- The commit has been verified in staging.
- Production EC2, Docker PostgreSQL, Tunnel, and both VPC Services are healthy.
- pgBackRest WAL/PITR, monthly archives, Bucket Lock, and restore drills have
  been verified.
- Production Terraform has no pending infrastructure change outside the release.
- Production `CORS_ORIGINS` contains only real origins.
- The `production` GitHub Environment contains production secrets and
  variables, with no staging values reused.
- Dapp production runtime secrets have been provisioned.
- Required reviewers are enabled and an operator is available for rollback.

### Deployment steps

1. Open a pull request from the release branch or `develop` into `main`.
2. Wait for pull-request CI and reviews to complete.
3. Merge into `main`.
4. CI runs again on the `main` commit.
5. The **Deploy** workflow creates the **Deploy (production)** job.
6. A required reviewer checks the commit SHA and staging evidence, then
   approves the GitHub Environment.
7. Monitor the RPC rollout, all four Cloudflare deployments, and the automated
   end-to-end smoke test until completion.

Never deploy from a laptop to compensate for a failed step. The workflow checks
out the exact `head_sha` that passed CI, so every fix must return through Git and
CI.

### Verify production

1. Check the gateway `/healthz` endpoint.
2. Smoke-test TradingService and AdminService through the gateway.
3. Verify dapp login/session behavior, admin routes, live asset logos/data, and
   landing canonical metadata.
4. Verify CORS from the real dapp/admin origins and confirm unknown origins are
   rejected.
5. Inspect Cloudflare logs, CloudWatch Logs/alarms, Sentry, and the Durable
   Object rate limiter.
6. Check `postgres-backup` health, WAL archival, R2 backup, and restore-drill
   evidence after deployment.

## 7. Rollback

The Deploy workflow automatically restores changed targets after a rollout or
smoke-test failure: RPC uses the previous image tag, Workers use their previous
version, and Pages uses its rollback API. After immediate recovery, prefer a
Git rollback so source and deployed state converge:

1. Run `git revert` for the faulty commit on the appropriate branch.
2. Push or merge the revert into `develop` or `main`.
3. Wait for CI and the Deploy workflow.
4. Repeat the environment verification checklist.

For a production incident that requires an immediate Worker rollback, an
authorized operator may use Cloudflare version history:

```bash
pnpm --filter @apps/dapp exec wrangler rollback --env production
pnpm --filter @apps/landing exec wrangler rollback --env production
pnpm --filter @services/api-gateway exec wrangler rollback --env production
```

Roll back admin through the environment's Pages deployment history, then still
create a Git revert so source and deployed state converge. RPC rollback reuses
the previous immutable ECR tag through SSM.

## 8. Definition of done

Before declaring setup or deployment complete:

- [ ] Environment values and URLs belong to the correct environment; no
  `example.com` placeholder remains.
- [ ] No secret appears in Git, shell history, or logs.
- [ ] `mise run typecheck` passes.
- [ ] `mise run check:ci` passes.
- [ ] `mise run lint` passes.
- [ ] `mise run test` and `mise run test:coverage` pass.
- [ ] `mise run test:e2e:production` passes.
- [ ] `mise run build` passes.
- [ ] `mise run test:docker` passes.
- [ ] `mise run test:protocol` and `mise run security:audit` pass.
- [ ] `mise run terraform:check` passes when AWS/Cloudflare IaC changed.
- [ ] Gateway health, TradingService, and AdminService smoke tests pass.
- [ ] Frontend origins match gateway `CORS_ORIGINS`.
- [ ] Production has a rollback owner and backup-health evidence.

## 9. Current limitations to resolve

- The AWS state bucket, GitHub OIDC provider, and Terraform execution role are
  account-level root-of-trust bootstrap resources; a state cannot create the
  bucket and identity on which it already depends.
- Workers VPC Services remain a Cloudflare beta; review release notes before
  upgrading the Cloudflare provider.
- After the first apply, copy the deploy-role output into the GitHub Environment
  and confirm the SNS subscription before accepting traffic.

Do not mark an environment as ready until its applicable items above are fixed
or an explicit risk-acceptance decision has been recorded.
