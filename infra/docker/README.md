# Docker infrastructure

This directory is the repository's single source of truth for Docker build and
Compose configuration. Application and service workspaces must not own separate
Dockerfiles.

## Layout

The operations surface is intentionally flat: the base file and every
environment overlay are visible together instead of being hidden in one-file
subdirectories.

```text
infra/docker/
├── compose.yaml             # canonical nine-container model and networks
├── compose.dev.yaml         # local runtime/port overrides
├── compose.staging.yaml     # staging dapp overrides
├── compose.prod.yaml        # production dapp overrides
├── compose.ec2.yaml         # private AWS RPC/PostgreSQL runtime from ECR
├── dapp.Dockerfile          # vinext standalone image
├── admin-rpc.Dockerfile     # admin facade: Connect + native gRPC
├── trading-rpc.Dockerfile   # Nest/Fastify Connect + gRPC image
├── workspace-dev.Dockerfile # shared non-root local development image
└── secrets/                 # git-ignored runtime secrets
```

`compose.yaml` must remain the first `-f` argument so every relative path is
resolved from `infra/docker`:

```bash
docker compose \
  -f infra/docker/compose.yaml \
  -f infra/docker/compose.dev.yaml \
  --profile dev \
  --profile vpc \
up --build
```

`compose.ec2.yaml` is intentionally standalone. Terraform installs it on the
private host; it runs `admin-rpc`, `trading-rpc`, PostgreSQL, the complete
pgBackRest/R2 backup scheduler, and a digest-pinned Cloudflare Tunnel. It
publishes no host ports, keeps database/backup/restore data on protected
encrypted EBS mounts, reads credentials only from file-backed Docker secrets,
and sends container logs to pre-created CloudWatch log groups. Application CI
supplies immutable ECR image tags and invokes the host deployment command
through AWS Systems Manager.

All nine containers are declared in `compose.yaml`. Profiles only select the
runtime topology: `admin`, `landing`, `api-gateway`, and `postgres` use `dev`;
`admin-rpc`, `trading-rpc`, and `cloudflared` use `vpc`; `postgres-backup` uses
`backup`; `dapp` is the default service. The development entrypoint activates
the `dev` and `vpc` profiles.

Use mise as the public command interface. Its Docker and infrastructure tasks
delegate to the root `Makefile`, which remains the low-level Compose source of
truth. Run `mise run docker:check` after changing Docker configuration.

## Native hot-reload topology

`mise run dev` starts PostgreSQL, the VPC-visible trading-rpc origin, and
cloudflared before launching all native development processes through Turbo.
The trading/admin VPC origins publish Connect/gRPC on `46104`–`46107`, while
native trading-rpc uses `46004`/`46005` and native admin-rpc uses
`46006`/`46007`.

Ctrl-C stops the native processes and leaves the infrastructure available for
fast restarts. Stop and remove those containers without deleting PostgreSQL
data with:

```bash
mise run dev:infra:stop
```

## Full development stack

After provisioning the rotated Cloudflare Tunnel token and authenticating
Wrangler once, one command starts all six application runtimes plus PostgreSQL
and the tunnel connector:

```bash
mise run docker:start
```

To start one application service and only its declared Compose dependencies,
use the matching mise task:

```bash
mise run docker:start:dapp
mise run docker:start:admin
mise run docker:start:landing
mise run docker:start:api-gateway
mise run docker:start:admin-rpc
mise run docker:start:trading-rpc
```

These tasks delegate to the corresponding `start-*-development` Make targets;
the Makefile remains the internal source of truth for Compose dependencies.

`admin` and `api-gateway` follow the Compose dependency graph through
`cloudflared`, `trading-rpc`, and PostgreSQL, so they require the same
Cloudflare credentials as the full stack. `dapp`, `landing`, `admin-rpc`, and
`trading-rpc` do not synchronize unrelated Cloudflare credentials. The shared
development workspace image is built automatically for `admin`, `landing`,
and `api-gateway`; this does not start the dapp container.

| Runtime | Local URL |
| --- | --- |
| dapp | `http://localhost:46000` |
| admin | `http://localhost:46001` |
| landing | `http://localhost:46002` |
| api-gateway | `http://localhost:46003` |
| admin-rpc VPC-origin Connect | `http://localhost:46106` |
| admin-rpc VPC-origin gRPC | `localhost:46107` |
| trading-rpc VPC-origin Connect | `http://localhost:46104` |
| trading-rpc VPC-origin gRPC | `localhost:46105` |
| PostgreSQL | `postgresql://trading_rpc:trading_rpc_local@localhost:46008/trading_rpc` |

These defaults deliberately avoid common framework and database ports. Copy
the repository root `.env.sample` to `.env` to make the map explicit or
override a single host port without changing Compose files. Native trading-rpc
uses `46004`/`46005` and native admin-rpc uses `46006`/`46007`; their Docker VPC
origins use `46104`–`46107` so both pairs can run during `mise run dev`.

The gateway is not attached to the origin's private Compose network. It reaches
`trading-rpc.internal:3001` only through the remote `TRADING_RPC` VPC Service
binding. The browser-facing admin app uses the host-published gateway URL.
`admin-rpc` reaches `trading-rpc:50051` only through the separate internal
`admin-rpc-internal` network; it has no CoinGecko or database adapter. Its
Connect listener is exposed to `cloudflared` only as
`admin-rpc.internal:3001` on `admin-rpc-private`, ready for the gateway's
separate `ADMIN_RPC` VPC Service binding.
Follow or stop the entire stack with:

```bash
make logs-development
mise run docker:stop
make psql-development
```

`postgres-data` persists PostgreSQL 18 data across container recreation. The
database uses the dedicated `trading-rpc-data` network, shared only with
`trading-rpc`; neither the gateway nor cloudflared can resolve the database
service. The loopback port `46008` exists only in the development overlay for
`psql` and database GUI tools, avoiding collisions with a host PostgreSQL on
`5432`.

The committed credentials are local-development defaults, not deployable
secrets. Override `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` when
needed (URL-encode special password characters). Remove local data explicitly
only when a clean database is intended:

```bash
make stop-development
docker volume rm vibe-code-stack_postgres-data
```

## Workers VPC tunnel

The VPC development target runs PostgreSQL plus two origin-path containers:

```text
Cloudflare Workers VPC
  -> Cloudflare Tunnel
  -> cloudflared
     +-> trading-rpc.internal:3001
     +-> admin-rpc.internal:3001
```

`trading-rpc-private` and `admin-rpc-private` are isolated internal networks,
each shared only by its origin and the tunnel connector; `api-gateway` is
deliberately excluded. Docker registers the corresponding `*.internal` alias
only on its private network. The implicit Compose service names remain
available inside their capability-owned networks, but the explicit aliases are
the canonical VPC targets. Each VPC runtime has only the network access it
needs:
`trading-rpc-egress` lets the market-data adapter call CoinGecko, while
`cloudflare-egress` lets the connector reach Cloudflare without putting both
origins on the same general-purpose bridge. `admin-rpc-internal` carries only
native gRPC from admin-rpc to trading-rpc. The connector always pulls the latest
`cloudflared` image, uses QUIC, and reads its remotely-managed tunnel token from
a Docker secret.

A token exposed through chat, logs, or shell history is compromised and must
not be reused. Rotate it in Cloudflare first, then create the local secret
without putting the value in a command argument:

```bash
mkdir -p infra/docker/secrets
install -m 600 /dev/null infra/docker/secrets/cloudflare-tunnel-token
${EDITOR:-vi} infra/docker/secrets/cloudflare-tunnel-token

make start-vpc-development
make logs-vpc-development
```

For a token stored elsewhere, override the secret path:

```bash
make start-vpc-development \
  CLOUDFLARE_TUNNEL_TOKEN_FILE=/absolute/path/to/cloudflare-tunnel-token
```

Override the development private hostname without changing Compose files:

```bash
TRADING_RPC_PRIVATE_HOSTNAME=trading-rpc.dev.internal \
  ADMIN_RPC_PRIVATE_HOSTNAME=admin-rpc.dev.internal \
  make start-vpc-development
```

Configure two Cloudflare VPC Services on the same tunnel:

- `TRADING_RPC`: type `http`, host `trading-rpc.internal`, HTTP port `3001`.
- `ADMIN_RPC`: type `http`, host `admin-rpc.internal`, HTTP port `3001`.

Both use the remotely-managed tunnel represented by the token. Use the private
network aliases, never `localhost`, and bind each resulting service ID to the
matching gateway binding.

Development exposes the Docker VPC origin on `127.0.0.1:46104` (Connect) and
`127.0.0.1:46105` (gRPC); native trading-rpc uses `46004`/`46005`. These host
mappings are for Postman/local diagnostics only.
Workers VPC traffic always uses the appropriate private `*.internal:3001` path.

At Nest bootstrap, trading-rpc waits for PostgreSQL, applies its generated
feature-local Drizzle migrations, and then opens RPC listeners. Drizzle records
checksums in `drizzle.__drizzle_migrations`; the initial migration is
idempotent so an existing local volume can be adopted without deleting data.
Every successful
`GetMarkets` call batch-upserts the latest snapshots into
`market_data.market_snapshots`; shutdown drains the Node PostgreSQL pool.

Inspect the reference table with:

```sql
SELECT coin_id, quote_currency, current_price, source_updated_at, persisted_at
FROM market_data.market_snapshots
ORDER BY coin_id;
```

The repository's `env.development` already contains the registered
`TRADING_RPC` binding. Add the real `ADMIN_RPC` service ID after provisioning
that external VPC Service. With the VPC profile healthy, run the Gateway locally
through the remote bindings:

```bash
pnpm dev:gateway
```

The full Docker stack uses the same binding. `make start-development` refreshes
`infra/docker/secrets/cloudflare-api-token` from the active Wrangler
authentication (`wrangler login` or `CLOUDFLARE_API_TOKEN`), mounts it as a
Docker secret, and launches Vite with `CLOUDFLARE_ENV=development`. The token is
never copied into the image or exposed to Worker code as a binding.

The workspace image installs the operating-system CA bundle because `workerd`
uses it to verify the remote-binding proxy's TLS certificate.

If Wrangler has not been authenticated yet, run this once on the host:

```bash
pnpm --filter @services/api-gateway exec wrangler login
```

The API token secret is refreshed without printing the bearer token. Both
files under `infra/docker/secrets/` are Git-ignored and must retain mode `0600`.
For non-interactive environments, provide `CLOUDFLARE_API_TOKEN` before running
`make start-development`; Wrangler will copy that active credential into the
Docker secret.

Stop and remove only the VPC profile containers with:

```bash
make stop-vpc-development
```

## Production PostgreSQL recovery

### Architecture, RPO, and RTO

Production uses two independent physical recovery paths:

- pgBackRest continuously archives WAL to a private R2 PITR bucket and keeps at
  least 35 days of recovery history. PostgreSQL forces a WAL archive at least
  every 240 seconds; backup health becomes unhealthy after five minutes of WAL
  lag. The recovery point objective is therefore **RPO <= 5 minutes**.
- A monthly `pg_basebackup` snapshot is encrypted to an offline-held age
  recipient and published under `monthly/YYYY/MM/<backup-id>/` in a second
  private R2 bucket. `_SUCCESS.json` is written last and authenticates the
  publication with an AWS KMS HMAC key, so R2 object-write credentials alone
  cannot forge a recovery point.

Every restore is written under `/var/lib/postgres-backup/restores` on the
dedicated `postgres-restore-stage` volume. It never overwrites `postgres-data`,
changes `DATABASE_URL`, or cuts traffic over automatically. Verification starts
the restored cluster with TCP and archiving disabled, checks PostgreSQL identity,
checksums, Drizzle migrations, and required tables, then stops it. The recovery
time objective is **RTO <= 3,600 seconds**; only a measured EC2 restore drill
proves that objective.

### R2 buckets, tokens, Bucket Lock, and lifecycle

Create two private buckets with example names such as:

| Bucket | Purpose | Runtime token |
| --- | --- | --- |
| `example-trading-postgres-pitr` | pgBackRest full/diff/incr backups and WAL | Object Read & Write, scoped only to this bucket |
| `example-trading-postgres-archive` | immutable encrypted monthly archives | Object Read & Write, scoped only to this bucket |

Do not enable `r2.dev` or a custom domain. Cloudflare supports bucket-scoped
Object Read & Write tokens for the S3-compatible API; retain a separate admin
token only for audited bucket configuration. See the official
[R2 token permissions](https://developers.cloudflare.com/r2/api/tokens/).

On the archive bucket, configure these exact prefix rules in **R2 > Bucket >
Settings**:

1. Bucket Lock: name `monthly-400-days`, prefix `monthly/`, duration 400 days.
2. Lifecycle: name `monthly-expire-400-days`, prefix `monthly/`, expire after
   400 days.
3. Lifecycle: name `staging-expire-7-days`, prefix `staging/`, expire after
   seven days.

Bucket Lock prevents overwrites/deletes until retention expires and takes
precedence over lifecycle deletion. Prefix-scoped lock and lifecycle rules are
documented by Cloudflare in [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
and [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
Verify the committed configuration without changing it:

```bash
pnpm exec wrangler r2 bucket lock list example-trading-postgres-archive
pnpm exec wrangler r2 bucket lifecycle list example-trading-postgres-archive
```

### AWS Secrets Manager, KMS, and the EC2 instance role

Store the normal runtime material as one Secrets Manager JSON document. The
value must contain exactly these required string keys:

```json
{
  "POSTGRES_PASSWORD": "example-only",
  "POSTGRES_REPLICATION_PASSWORD": "example-only",
  "R2_PITR_ACCESS_KEY_ID": "example-only",
  "R2_PITR_SECRET_ACCESS_KEY": "example-only",
  "R2_ARCHIVE_ACCESS_KEY_ID": "example-only",
  "R2_ARCHIVE_SECRET_ACCESS_KEY": "example-only",
  "PGBACKREST_CIPHER_PASSPHRASE": "example-only"
}
```

Store the age private identity as a **separate secret whose SecretString is the
raw `AGE-SECRET-KEY-1...` identity**, not JSON. Set only identifiers in the EC2
environment:

```bash
export AWS_REGION=ap-southeast-1
export POSTGRES_BACKUP_RUNTIME_SECRET_ID=production/example/runtime
export POSTGRES_BACKUP_RECOVERY_SECRET_ID=production/example/monthly-age-identity
export POSTGRES_BACKUP_KMS_KEY_ID=alias/example-postgres-monthly-auth
export POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS=arn:aws:kms:ap-southeast-1:111122223333:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
```

The KMS key must be customer-managed `HMAC_256` with usage
`GENERATE_VERIFY_MAC`; the scripts use `HMAC_SHA_256`. AWS documents that
`GenerateMac` and `VerifyMac` provide integrity and authenticity while key
material remains in KMS: [HMAC keys in AWS KMS](https://docs.aws.amazon.com/kms/latest/developerguide/hmac.html).
The backup marker records the immutable `KeyId` ARN returned by `GenerateMac`,
never the configurable alias. `POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS` is the
comma-separated recovery key ring. During manual rotation, add the new key ARN,
switch the alias, and keep every retired key enabled and in this ring for at
least the full 400-day immutable archive retention period. Remove an old key
only after every marker signed by it has expired and restore drills confirm the
remaining ring.

Attach an EC2 instance profile with only:

- `secretsmanager:GetSecretValue` on the runtime and age-recovery secret ARNs;
- `kms:GenerateMac` on the active HMAC key ARN and `kms:VerifyMac` on every ARN
  in the trusted recovery key ring;
- `cloudwatch:PutMetricData` only if the health metric example below is used.

Do not store static AWS credentials on EC2. Require IMDSv2 and allow the
containerized AWS CLI to reach it; if the host enforces a hop limit, configure a
limit compatible with the Docker bridge. AWS recommends scoping
`GetSecretValue` through the EC2 role in its
[Secrets Manager identity policy guidance](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_iam-policies.html).

### EC2 filesystem sizing

Use encrypted EBS volumes and monitor both bytes and inodes. At minimum:

- `postgres-data`: current database size plus WAL/checkpoint growth and normal
  PostgreSQL operating headroom;
- `postgres-backup-stage`: at least 1.5 times the previous monthly compressed
  artifact size, plus 10 GiB minimum free space;
- `postgres-restore-stage`: a separate restore/drill volume with room for R2
  ciphertext, decrypted compressed artifacts, and 1.25 times the authenticated
  expanded database size;
- Docker/pgBackRest spool: enough for an R2 outage without filling the root or
  database filesystem.

Place `postgres-restore-stage` on a dedicated EBS filesystem for production,
not merely a directory on the database volume. Failed scheduled drills publish
their result to `postgres-backup-state` and delete the temporary restored
cluster; manual failed restores remain available for operator forensics.

### Start production

After the buckets, rules, secrets, KMS key, instance role, environment variables,
and EBS mounts are provisioned, start the complete production topology with:

```bash
make start-production
```

This first atomically fetches runtime secrets into
`/run/vibe-code-stack/secrets/current`, then builds/starts the production
Compose profiles. Never paste secret values into Compose files or shell
arguments.

### Inspect and run backups

```bash
make db-backup-info
make db-backup-health
make db-backup-check
make db-backup-verify
make db-backup-now
```

`db-backup-now` is serialized by the same global lock as scheduled jobs.
`db-backup-health` prints the persisted JSON result and preserves the health
script exit status.

### PITR recovery: latest or target time

Both commands require an exact confirmation phrase and generate a fresh path on
the isolated restore volume:

```bash
make db-restore-latest CONFIRM_RESTORE=restore-into-new-volume

make db-restore-at \
  CONFIRM_RESTORE=restore-into-new-volume \
  TARGET_TIME=2026-07-15T12:00:00Z
```

Read `<target>/restore-result.json`, verify `status == "success"` and
`durationSeconds < 3600`, then perform an application-level acceptance test.
pgBackRest keeps restored tablespaces in the isolated sibling
`<target>.tablespaces` so the PGDATA target is empty when restore begins; move
the target and this sibling as one recovery unit.
Cutover is a separate change-management operation; these commands never point
the running service at the restored cluster.

### Monthly recovery and age key recovery

Use a new target below the dedicated restore root. The recovery script first
rejects future/path-inconsistent markers, verifies the KMS HMAC, validates
outer and encrypted inner manifests, retrieves the age identity on demand into
tmpfs, removes it immediately after decryption, checks capacity, and extracts:

```bash
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.prod.yaml \
  --profile backup exec --user postgres postgres-backup sh -ceu '
    target="$POSTGRES_RESTORE_ROOT/manual-monthly-$(date -u +%Y%m%dT%H%M%SZ)-$$"
    /usr/local/bin/postgres-backup/restore-monthly.sh \
      --target-dir "$target" --latest
    printf "Restored into isolated directory: %s\n" "$target"
  '
```

Keep at least two offline, access-controlled copies of the age identity and the
pgBackRest cipher passphrase. Test the escrowed identity in a scheduled drill;
never print it, copy it into an image, or upload it to R2. Loss of every age
identity makes monthly archives unrecoverable. Loss of the pgBackRest cipher
passphrase makes PITR backups unrecoverable. Loss/deletion of the KMS HMAC key
prevents authenticated monthly recovery and must not be bypassed.

### Restore drills and CloudWatch health

Run an immediate serialized PITR drill:

```bash
make db-restore-drill
```

Scheduled evidence is written to:

```text
/var/lib/postgres-backup/state/pitr-drill.last-result.json
/var/lib/postgres-backup/state/monthly-drill.last-result.json
```

Terraform installs `vibe-rpc-monitor.timer` on the EC2 host. Every five minutes
it publishes `BackupHealthy`, `ContainersHealthy`, maximum disk/inode usage, and
memory usage to `VibeCodeStack/RpcHost` without exposing backup data. The
matching alarms treat missing metrics as breaching and notify the encrypted SNS
operations topic.

```bash
systemctl status vibe-rpc-monitor.timer
sudo systemctl start vibe-rpc-monitor.service
journalctl -u vibe-rpc-monitor.service
```

Confirm the email sent by the Terraform-managed SNS subscription before
accepting traffic. Detailed backup JSON remains on the host/log platform;
credentials and raw command output never enter metric dimensions.

### Failure procedures

- **R2 outage:** do not disable `archive_mode` or change the archive command.
  Alert immediately, watch `/var/spool/pgbackrest` and disk/inodes, restore R2
  connectivity, then run `make db-backup-check` and force/observe a WAL switch.
- **WAL growth:** add encrypted disk capacity before the spool or PostgreSQL
  filesystem fills. If capacity cannot be added safely, stop application writes
  before disk exhaustion; never delete unarchived WAL manually.
- **Cipher or recovery-key loss:** stop retention/lifecycle changes, audit
  Secrets Manager/KMS and offline escrow, and test a recovered key only against
  a fresh isolated target. Do not create an unauthenticated restore bypass.
- **Unhealthy backup state:** preserve the JSON state and logs, classify the
  failing job, fix the boundary, run check/verify/manual backup as applicable,
  and require a successful restore drill before clearing the incident.
