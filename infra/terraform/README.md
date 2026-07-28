# AWS RPC infrastructure

Terraform provisions `admin-rpc` and `trading-rpc` on a private Amazon EC2 host.
Cloudflare Workers reaches their Connect listeners only through a remotely
managed Cloudflare Tunnel and two Workers VPC Services. No RPC, database, SSM,
or SSH port is public.

```text
api-gateway Worker
  -> Workers VPC Services
  -> Cloudflare Tunnel
  -> one private EC2 instance
       - admin-rpc:3001 -> trading-rpc:50051
       - trading-rpc:3001 -> Docker PostgreSQL 18
       - pgBackRest WAL/PITR + encrypted monthly backups -> private R2
```

Terraform owns infrastructure. `.github/workflows/deploy.yml` owns application
releases: it builds immutable commit-SHA images, pushes them to ECR, rejects
HIGH/CRITICAL ECR scan findings, writes runtime secrets, and performs a
Systems Manager rollout. Never use `terraform apply`,
SSH, `docker compose up`, or Wrangler deployment commands from a local machine.

## What Terraform creates

- one VPC per environment, with one public subnet for NAT and one private
  application subnet for the EC2/PostgreSQL host;
- one NAT gateway and Elastic IP per environment;
- one fixed EC2 host per environment so persistent PostgreSQL EBS volumes are
  never discarded by an automatic ephemeral-host replacement;
- Amazon Linux 2023, IMDSv2-only metadata, encrypted gp3 disks, no public IP,
  no inbound security-group rules, and Systems Manager access instead of SSH;
- three protected encrypted EBS volumes for PostgreSQL data/WAL, monthly backup
  staging, and isolated restore drills;
- immutable/scanned ECR repositories for admin-rpc, trading-rpc, and the
  repository's PostgreSQL 18 + pgBackRest image;
- a symmetric KMS key for runtime encryption and a separate HMAC_256 KMS key
  for authenticating monthly backup manifests;
- Secrets Manager, CloudWatch Logs, EC2/custom health alarms, an SNS email
  subscription that the recipient must confirm, and a desired-release SSM parameter used after host
  replacement;
- a private KMS-encrypted S3 bootstrap-artifact bucket and free S3 gateway
  endpoint, keeping EC2 user-data far below its size limit;
- one remotely managed Cloudflare Tunnel and two scoped Workers VPC Services;
- an environment-scoped GitHub OIDC application-deploy role.

## Root-of-trust bootstrap

Terraform cannot create the S3 bucket that already stores its own state or the
first IAM role used to run Terraform. Provision these account-level primitives
once through the organization's AWS account bootstrap process:

1. An S3 state bucket with Block Public Access, customer-managed KMS encryption,
   versioning, and state locking through Terraform's native `use_lockfile`
   mechanism.
2. The AWS GitHub OIDC provider for `https://token.actions.githubusercontent.com`
   with audience `sts.amazonaws.com`.
3. A Terraform execution role trusted only by this repository's GitHub
   `staging` and `production` Environments. It needs permission to manage the
   resources declared under `infra/terraform/` and the matching state key.

Do not create access keys. The workflow assumes both Terraform and application
roles with short-lived GitHub OIDC credentials. The account bootstrap belongs
outside this application state so deleting an environment cannot delete its
own state or root deployment identity.

## GitHub Environment configuration

Create `staging` and `production` Environments. Require reviewers for
production. Set these variables in both:

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | `ap-southeast-1` |
| `AWS_TERRAFORM_ROLE_ARN` | Bootstrap-provisioned Terraform role |
| `AWS_GITHUB_OIDC_PROVIDER_ARN` | Account-level GitHub OIDC provider |
| `TF_STATE_BUCKET` | Encrypted/versioned Terraform state bucket |
| `TF_STATE_KMS_KEY_ARN` | Customer-managed KMS key used by the state bucket |
| `AWS_RPC_DEPLOY_ROLE_ARN` | `github_deploy_role_arn` output after first apply |
| `OPERATIONS_ALERT_EMAIL` | On-call email that confirms the encrypted SNS subscription |
| `R2_PITR_BUCKET` | Private bucket receiving pgBackRest backups and WAL |
| `R2_ARCHIVE_BUCKET` | Private bucket receiving encrypted monthly archives |
| `POSTGRES_ARCHIVE_AGE_RECIPIENT` | Public age recipient used for monthly encryption |

Required infrastructure secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account owning Tunnel and VPC Services |
| `CLOUDFLARE_API_TOKEN` | Tunnel, Connectivity Directory, Worker, and Pages deployment permissions |

Required RPC runtime secrets:

| Secret | Purpose |
| --- | --- |
| `ADMIN_AUTH_EMAIL` | Admin login identity |
| `ADMIN_AUTH_PASSWORD` | At least 12 characters |
| `JWT_SECRET` | At least 32 characters; CI gives the same value to admin-rpc and gateway |
| `COINGECKO_API_KEY` | Trading market-data provider key |
| `ADMIN_RPC_SENTRY_DSN` | Optional admin-rpc telemetry |
| `TRADING_RPC_SENTRY_DSN` | Optional trading-rpc telemetry |
| `POSTGRES_PASSWORD` | PostgreSQL application-owner password |
| `POSTGRES_REPLICATION_PASSWORD` | Dedicated pgBackRest replication role password |
| `R2_PITR_ACCESS_KEY_ID` / `R2_PITR_SECRET_ACCESS_KEY` | Bucket-scoped PITR credentials |
| `R2_ARCHIVE_ACCESS_KEY_ID` / `R2_ARCHIVE_SECRET_ACCESS_KEY` | Bucket-scoped monthly-archive credentials |
| `PGBACKREST_CIPHER_PASSPHRASE` | Encrypts the pgBackRest repository |
| `POSTGRES_BACKUP_AGE_IDENTITY` | Offline-escrowed age identity used only for restore drills |

The deploy workflow fetches the Tunnel token and stores runtime values in one
Secrets Manager document. The age identity is written to a separate recovery
secret. Terraform creates only the secret containers, so secret values never
enter Terraform configuration or state. Configure the R2 Bucket Lock/lifecycle
rules from `infra/docker/README.md` before the first production release.

## Plan and apply

1. Open **Actions → Terraform → Run workflow**.
2. Select `staging` and `apply`. Approve the plan job, inspect its rendered plan
   and artifact, then separately approve the apply job.
3. Confirm the SNS subscription email sent to `OPERATIONS_ALERT_EMAIL`.
4. Copy the `github_deploy_role_arn` output into the staging
   `AWS_RPC_DEPLOY_ROLE_ARN` GitHub Environment variable.
5. Verify that `operations_topic_arn` has the confirmed email subscription.
6. Repeat for production. Production apply is accepted only from `main` and
   staging apply only from `develop`.

Every pull request touching Terraform runs format and provider-backed validate.
Locally, read-only validation is available through:

```bash
mise run terraform:check
```

This command initializes provider plugins with `-backend=false`; it never
reads remote state and never changes infrastructure.

## Application release and replacement recovery

After infrastructure exists, a successful CI run deploys in this order:

1. Authenticate to AWS with the environment-specific OIDC role.
2. Read non-secret integration outputs from remote state.
3. Build/push the two RPC images and PostgreSQL backup image, then wait for ECR
   scanning.
4. Seed both Secrets Manager containers and fetch the current Tunnel token.
5. Deploy through Systems Manager and wait for PostgreSQL, backup scheduler,
   RPC, and Tunnel health.
6. Persist the successful SHA in Parameter Store so a Terraform-managed host
   replacement converges to the last healthy release after reattaching EBS.
7. Inject Terraform's VPC Service IDs into the generated gateway config, then
   deploy Cloudflare targets.

Rollback by reverting the bad commit and letting CI redeploy. During an active
incident, re-run a previously successful Deploy workflow; it checks out and
deploys that run's immutable commit SHA under the same environment approval.

The host is intentionally fixed, but Terraform can still replace it when its
AMI or bootstrap changes. That operation causes downtime: Terraform detaches
and reattaches the three protected EBS volumes, then the boot service mounts
them and restores the last successful release from Parameter Store. Never
remove an EBS or KMS `prevent_destroy` guard merely to make a plan apply; first
complete and verify an R2 restore drill, then follow an explicitly approved
decommission procedure.

## Cost and availability defaults

Both environments deliberately use one EC2 instance and one NAT gateway for
the current traffic level. PostgreSQL durability comes from protected encrypted
EBS plus the existing R2 PITR/monthly recovery design; this is not multi-AZ and
host maintenance causes downtime. Review capacity and measured restore drills
before production traffic. Move to a replicated database topology only when
the availability requirement justifies it.

Production intentionally uses the same initial storage and log-retention
profile as staging:

| Capacity | Staging | Production |
| --- | ---: | ---: |
| Root EBS | 30 GiB | 30 GiB |
| PostgreSQL data EBS | 30 GiB | 30 GiB |
| Backup-stage EBS | 20 GiB | 20 GiB |
| Restore-stage EBS | 30 GiB | 30 GiB |
| Total EBS | 110 GiB | 110 GiB |
| CloudWatch Logs retention | 30 days | 30 days |

`scripts/check-deployment-infrastructure.test.ts` locks these values for both
environments so a capacity increase must be an explicit reviewed change.

Workers VPC Services are currently a Cloudflare beta feature. The individual
service bindings intentionally limit each Worker binding to one hostname and
port. Monitor Cloudflare release notes and revalidate provider plans before
upgrading the pinned Cloudflare provider.
