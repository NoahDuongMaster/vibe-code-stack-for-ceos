# Trading RPC PostgreSQL R2 Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tested PostgreSQL PITR and immutable monthly backup/restore workflows for the EC2 Docker deployment, using pgBackRest and private Cloudflare R2 storage.

**Architecture:** A pinned PostgreSQL 18 image runs pgBackRest locally so `archive_command` can continuously push WAL to R2. A single scheduler sidecar shares PostgreSQL data read-only and the Unix socket, manages full/differential/incremental backups, creates encrypted monthly `pg_basebackup` archives, publishes backup health, and performs isolated restore drills without Docker-socket access.

**Tech Stack:** PostgreSQL 18.4, pgBackRest 2.58.0, Cloudflare R2 S3 API, rclone 1.74.1, age 1.3.1, AWS CLI 2.34.63, Docker Compose, POSIX/Bash scripts, jq, Vitest/repository CI gates.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-15-trading-rpc-postgresql-r2-backup-design.md`.
- RPO is at most five minutes; configure PostgreSQL `archive_timeout=240s` and fail health when archive lag exceeds five minutes.
- RTO is at most 3,600 seconds and is proven only by a production-like EC2 restore drill.
- Retain operational PITR for at least 35 days and at least 12 monthly physical recovery points.
- Never restore over `postgres-data`, stop production, alter `DATABASE_URL`, or cut over automatically.
- Never commit or log R2 keys, PostgreSQL credentials, pgBackRest cipher material, or age private identities.
- Keep all Dockerfiles and Compose assets under `infra/docker`; add no workspace-local Dockerfile.
- Production containers do not mount the Docker socket and expose no backup or database port publicly.
- Use the existing `trading-rpc-data` private network for database traffic and a separate `postgres-backup-egress` network for R2/AWS traffic.
- Development requires no real R2 credential; CI uses a local pgBackRest repository and local rclone backend.
- Do not run a local production deploy or change production R2/AWS resources.

---

## File Structure

### New files

- `infra/docker/postgres.Dockerfile` — pinned PostgreSQL/backup toolchain image.
- `infra/docker/compose.backup-test.yaml` — local repository integration-test overlay.
- `infra/docker/postgres/config/backup-schedule.cron` — UTC scheduler contract.
- `infra/docker/postgres/scripts/backup-lib.sh` — validation, JSON logging, atomic state, and lock helpers.
- `infra/docker/postgres/scripts/render-pgbackrest-config.sh` — renders R2 or local pgBackRest config from runtime inputs.
- `infra/docker/postgres/scripts/postgres-entrypoint.sh` — renders backup config before delegating to the official entrypoint.
- `infra/docker/postgres/scripts/backup-entrypoint.sh` — creates/checks stanza, reconciles overdue jobs, and starts cron.
- `infra/docker/postgres/scripts/ensure-replication-role.sh` — creates/rotates the restricted physical-backup role.
- `infra/docker/postgres/scripts/run-backup-job.sh` — serializes jobs and records success/failure state.
- `infra/docker/postgres/scripts/reconcile-backups.sh` — runs overdue jobs after container restart.
- `infra/docker/postgres/scripts/backup-health.sh` — evaluates RPO, backup ages, disk, and drill state.
- `infra/docker/postgres/scripts/backup-monthly.sh` — physical snapshot, encryption, staging upload, verification, and publish.
- `infra/docker/postgres/scripts/restore-pitr.sh` — guarded latest/timestamp pgBackRest restore.
- `infra/docker/postgres/scripts/restore-monthly.sh` — guarded monthly download/decrypt/restore.
- `infra/docker/postgres/scripts/restore-verify.sh` — isolated PostgreSQL startup and SQL integrity checks.
- `infra/docker/postgres/scripts/sync-production-secrets.sh` — fetches runtime secrets into `/run/vibe-code-stack/secrets` using the EC2 instance profile.
- `infra/docker/postgres/tests/test-lib.sh` — dependency-free shell assertion helpers.
- `infra/docker/postgres/tests/render-config.test.sh` — config validation and secret-leak regression tests.
- `infra/docker/postgres/tests/job-health.test.sh` — locking, state, age, archive-lag, and disk tests.
- `infra/docker/postgres/tests/monthly-backup.test.sh` — publish-order and cleanup safety tests with command fakes.
- `infra/docker/postgres/tests/restore-guards.test.sh` — destructive-path and target-time validation tests.
- `infra/docker/postgres/tests/backup-integration.sh` — real local full/WAL/PITR/monthly restore test.
- `services/trading-rpc/src/config/runtime-environment.ts` — resolves file-backed runtime values before Zod validation.
- `services/trading-rpc/src/config/runtime-environment.test.ts` — database URL file and conflict tests.

### Modified files

- `infra/docker/compose.yaml` — custom PostgreSQL image, scheduler service, networks, volumes, and secret declarations.
- `infra/docker/compose.dev.yaml` — retain loopback-only development database behavior.
- `infra/docker/compose.prod.yaml` — production WAL/R2 settings and backup profile.
- `infra/docker/compose.staging.yaml` — explicit backup-disabled staging behavior unless credentials are provisioned.
- `infra/docker/secrets/.gitignore` — ignore every generated runtime secret while retaining the sentinel.
- `infra/docker/README.md` — EC2, R2, backup, restore, key-recovery, and drill runbook.
- `.dockerignore` — keep PostgreSQL Docker assets available to the build context while excluding secret files.
- `Makefile` — image validation, script tests, backup operations, secret sync, integration test, and guarded restore targets.
- `services/trading-rpc/src/index.ts` — resolves the file-backed database URL at the composition root.

---

### Task 1: Pin the PostgreSQL backup toolchain and render safe pgBackRest configuration

**Files:**
- Create: `infra/docker/postgres.Dockerfile`
- Create: `infra/docker/postgres/scripts/backup-lib.sh`
- Create: `infra/docker/postgres/scripts/render-pgbackrest-config.sh`
- Create: `infra/docker/postgres/scripts/postgres-entrypoint.sh`
- Create: `infra/docker/postgres/config/backup-schedule.cron`
- Create: `infra/docker/postgres/tests/test-lib.sh`
- Create: `infra/docker/postgres/tests/render-config.test.sh`
- Modify: `.dockerignore`
- Modify: `Makefile`

**Interfaces:**
- Consumes: secret files named by `R2_PITR_ACCESS_KEY_ID_FILE`, `R2_PITR_SECRET_ACCESS_KEY_FILE`, and `PGBACKREST_CIPHER_PASSPHRASE_FILE`.
- Produces: `render_pgbackrest_config OUTPUT_PATH`, `require_scalar_file NAME PATH`, `json_log LEVEL EVENT MESSAGE`, `retry_with_backoff COMMAND [ARGUMENT ...]`, and `/run/postgres-backup/pgbackrest.conf` mode `0600`.

- [ ] **Step 1: Write the failing render and image contract test**

Create `infra/docker/postgres/tests/test-lib.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

fail() { printf 'not ok - %s\n' "$*" >&2; exit 1; }
assert_file_contains() { grep -Fq -- "$2" "$1" || fail "$1 does not contain $2"; }
file_mode() { stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"; }
assert_file_mode() { [ "$(file_mode "$1")" = "$2" ] || fail "$1 mode is not $2"; }
assert_eq() { [ "$1" = "$2" ] || fail "expected [$2], got [$1]"; }
```

Create `infra/docker/postgres/tests/render-config.test.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'pitr-key\n' >"$tmp/key"
printf 'pitr-secret\n' >"$tmp/secret"
printf 'cipher-passphrase\n' >"$tmp/cipher"

export POSTGRES_BACKUP_REPOSITORY_TYPE=r2
export POSTGRES_USER=trading_rpc POSTGRES_DB=trading_rpc
export R2_ACCOUNT_ID=account123 R2_PITR_BUCKET=trading-rpc-postgres-pitr
export R2_PITR_ACCESS_KEY_ID_FILE="$tmp/key"
export R2_PITR_SECRET_ACCESS_KEY_FILE="$tmp/secret"
export PGBACKREST_CIPHER_PASSPHRASE_FILE="$tmp/cipher"

. "$ROOT/infra/docker/postgres/scripts/render-pgbackrest-config.sh"
render_pgbackrest_config "$tmp/pgbackrest.conf"
assert_file_mode "$tmp/pgbackrest.conf" 600
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-type=s3'
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-s3-region=auto'
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-retention-full-type=time'
assert_file_contains "$tmp/pgbackrest.conf" 'repo1-retention-full=35'
assert_file_contains "$tmp/pgbackrest.conf" 'archive-async=y'
assert_file_contains "$tmp/pgbackrest.conf" 'pg1-path=/var/lib/postgresql/18/docker'
printf 'ok - render config\n'
```

- [ ] **Step 2: Run the test and verify the missing renderer fails**

Run:

```bash
bash infra/docker/postgres/tests/render-config.test.sh
```

Expected: nonzero exit with `render-pgbackrest-config.sh: No such file or directory`.

- [ ] **Step 3: Implement the pinned image and configuration renderer**

Create `infra/docker/postgres.Dockerfile` with the verified official image digest and Alpine 3.24 package versions:

```dockerfile
FROM postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15

RUN apk add --no-cache \
      age=1.3.1-r5 \
      aws-cli=2.34.63-r0 \
      coreutils=9.11-r0 \
      jq=1.8.1-r0 \
      pgbackrest=2.58.0-r0 \
      rclone=1.74.1-r1 \
      util-linux=2.42.1-r0 \
  && install -d -o postgres -g postgres -m 0700 \
      /run/postgres-backup /var/lib/pgbackrest /var/log/pgbackrest \
      /var/spool/pgbackrest /var/lib/postgres-backup/state

COPY --chmod=0755 infra/docker/postgres/scripts/ /usr/local/bin/postgres-backup/
COPY --chmod=0644 infra/docker/postgres/config/backup-schedule.cron \
  /etc/postgres-backup/crontabs/postgres
RUN chown -R postgres:postgres /etc/postgres-backup/crontabs

ENTRYPOINT ["/usr/local/bin/postgres-backup/postgres-entrypoint.sh"]
CMD ["postgres"]
```

Create `backup-lib.sh` with scalar-file validation that rejects empty values and newline injection, atomic JSON writes through `jq`, and JSON logging to stdout. Implement `retry_with_backoff` with exactly four attempts separated by 5, 15, and 45 seconds; authentication, authorization, and repository-identity failures bypass retry. Implement `render_pgbackrest_config()` so R2 mode writes these exact settings:

```text
[trading-rpc]
pg1-path=/var/lib/postgresql/18/docker
pg1-socket-path=/var/run/postgresql
pg1-port=5432
pg1-user=trading_rpc
pg1-database=trading_rpc

[global]
repo1-type=s3
repo1-path=/production
repo1-s3-bucket=trading-rpc-postgres-pitr
repo1-s3-endpoint=account123.r2.cloudflarestorage.com
repo1-s3-region=auto
repo1-s3-uri-style=path
repo1-storage-verify-tls=y
repo1-cipher-type=aes-256-cbc
repo1-retention-full-type=time
repo1-retention-full=35
repo1-bundle=y
repo1-block=y
archive-async=y
spool-path=/var/spool/pgbackrest
compress-type=zst
process-max=2
start-fast=y
```

For `POSTGRES_BACKUP_REPOSITORY_TYPE=posix`, emit `repo1-type=posix`, `repo1-path=/var/lib/pgbackrest/repo`, the same retention/compression settings, and no S3/cipher keys. Write through a temporary file, `chmod 0600`, then atomically rename.

Create `postgres-entrypoint.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
. /usr/local/bin/postgres-backup/render-pgbackrest-config.sh

if [ "${POSTGRES_BACKUP_MODE:-disabled}" = enabled ]; then
  install -d -o postgres -g postgres -m 0700 /run/postgres-backup
  render_pgbackrest_config /run/postgres-backup/pgbackrest.conf
  chown postgres:postgres /run/postgres-backup/pgbackrest.conf
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
```

Create `backup-schedule.cron` so the image build is reproducible from the first
slice; later tasks add the referenced command implementations:

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 * * * * /usr/local/bin/postgres-backup/run-backup-job.sh incremental pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=incr backup
0 2 * * 1-6 /usr/local/bin/postgres-backup/run-backup-job.sh differential pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=diff backup
0 2 * * 0 /usr/local/bin/postgres-backup/run-backup-job.sh full pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=full backup
15 */6 * * * /usr/local/bin/postgres-backup/run-backup-job.sh check pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc check
30 3 * * 0 /usr/local/bin/postgres-backup/run-backup-job.sh verify pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc verify
0 4 1 * * /usr/local/bin/postgres-backup/run-backup-job.sh monthly /usr/local/bin/postgres-backup/backup-monthly.sh
0 6 * * 0 /usr/local/bin/postgres-backup/run-backup-job.sh pitr-drill /usr/local/bin/postgres-backup/restore-pitr.sh --latest --drill
0 6 2 * * /usr/local/bin/postgres-backup/run-backup-job.sh monthly-drill /usr/local/bin/postgres-backup/restore-monthly.sh --latest --drill
```

Add `!infra/docker/postgres/**` after the Markdown exclusions in `.dockerignore` so the new build assets remain in context.

- [ ] **Step 4: Add a focused Make target and run the tests**

Add:

```make
.PHONY: test-postgres-backup-scripts
test-postgres-backup-scripts:
	@set -eu; for test_file in infra/docker/postgres/tests/*.test.sh; do bash "$$test_file"; done
```

Run:

```bash
make test-postgres-backup-scripts
docker build --check -f infra/docker/postgres.Dockerfile .
docker build -f infra/docker/postgres.Dockerfile -t vibe-postgres:backup-test .
docker run --rm --entrypoint sh vibe-postgres:backup-test -ec \
  'postgres --version; pgbackrest version; age --version; rclone version | head -1; aws --version'
```

Expected: render test passes and versions begin with PostgreSQL `18.4`, pgBackRest `2.58.0`, age `1.3.1`, rclone `1.74.1`, and AWS CLI `2.34.63`.

- [ ] **Step 5: Commit the toolchain slice**

```bash
git add .dockerignore Makefile infra/docker/postgres.Dockerfile infra/docker/postgres
git commit -m "feat(infra): add PostgreSQL backup toolchain"
```

### Task 2: Wire production PITR, networks, volumes, and runtime secrets into Compose

**Files:**
- Create: `infra/docker/postgres/scripts/ensure-replication-role.sh`
- Create: `infra/docker/postgres/scripts/sync-production-secrets.sh`
- Create: `infra/docker/postgres/scripts/backup-root-entrypoint.sh`
- Create: `infra/docker/postgres/tests/development-reachability.smoke.sh`
- Create: `infra/docker/trading-rpc-entrypoint.sh`
- Create: `infra/docker/tests/trading-rpc-entrypoint.test.sh`
- Modify: `infra/docker/compose.yaml`
- Modify: `infra/docker/compose.dev.yaml`
- Modify: `infra/docker/compose.prod.yaml`
- Modify: `infra/docker/compose.staging.yaml`
- Modify: `infra/docker/secrets/.gitignore`
- Modify: `Makefile`
- Create: `services/trading-rpc/src/config/runtime-environment.ts`
- Create: `services/trading-rpc/src/config/runtime-environment.test.ts`
- Modify: `services/trading-rpc/src/index.ts`

**Interfaces:**
- Consumes: AWS Secrets Manager JSON at `POSTGRES_BACKUP_RUNTIME_SECRET_ID`, explicit `AWS_REGION`, and an EC2 instance profile.
- Produces: an atomically switched secret generation under `POSTGRES_BACKUP_SECRET_DIR/current`, service-private tmpfs copies readable only by the runtime UID, Compose services `postgres` and `postgres-backup`, volumes `postgres-socket`, `pgbackrest-spool`, `postgres-backup-state`, `postgres-backup-stage`, and network `postgres-backup-egress`.

- [ ] **Step 1: Add failing Compose assertions to `check-docker`**

Extend the existing JSON assertion to require:

```javascript
const postgres = config.services?.postgres;
const backup = config.services?.['postgres-backup'];
if (!postgres?.build?.dockerfile?.endsWith('infra/docker/postgres.Dockerfile')) {
  throw new Error('PostgreSQL must use the repository backup image');
}
if (!backup) throw new Error('Missing postgres-backup service');
if (backup.volumes?.some((mount) => mount.source === '/var/run/docker.sock')) {
  throw new Error('postgres-backup must not mount the Docker socket');
}
if (backup.ports?.length) throw new Error('postgres-backup must not publish ports');
for (const name of ['postgres-socket', 'pgbackrest-spool', 'postgres-backup-state', 'postgres-backup-stage']) {
  if (!config.volumes?.[name]) throw new Error(`Missing backup volume: ${name}`);
}
```

Run `make check-docker`. Expected: FAIL because the custom image and scheduler service do not exist.

- [ ] **Step 2: Define the shared base topology**

Change `postgres` to build `infra/docker/postgres.Dockerfile`, use image `vibe-postgres:${POSTGRES_IMAGE_TAG:-development}`, and profiles `[dev, vpc]`. Preserve `/var/lib/postgresql` and add:

```yaml
volumes:
  - postgres-data:/var/lib/postgresql
  - postgres-socket:/var/run/postgresql
  - pgbackrest-spool:/var/spool/pgbackrest
```

Declare `postgres-backup` with profile `backup`, no published ports,
`cap_drop: [ALL]`, only `CHOWN`, `SETUID`, and `SETGID` added back, and
`security_opt: [no-new-privileges:true]`. It starts through a root bootstrap
entrypoint, copies mounted root-owned secrets into its private tmpfs, then uses
`gosu` to execute the scheduler as the pinned image's `postgres` UID/GID 70.
Use:

```yaml
entrypoint: [/usr/local/bin/postgres-backup/backup-root-entrypoint.sh]
command: [/usr/local/bin/postgres-backup/backup-entrypoint.sh]
volumes:
  - postgres-data:/var/lib/postgresql:ro
  - postgres-socket:/var/run/postgresql
  - pgbackrest-spool:/var/spool/pgbackrest
  - postgres-backup-state:/var/lib/postgres-backup/state
  - postgres-backup-stage:/var/lib/postgres-backup/stage
networks:
  - trading-rpc-data
  - postgres-backup-egress
tmpfs:
  - /run/postgres-backup:mode=0700,uid=70,gid=70
  - /run/postgres-backup-secrets:mode=0700
```

Add the four named volumes and `postgres-backup-egress`. Keep `trading-rpc-data` separate from public-facing services.

- [ ] **Step 3: Enable production archiving without affecting development**

In `compose.prod.yaml`, set both PostgreSQL services to production image tags and configure:

```yaml
services:
  postgres:
    image: vibe-postgres:production
    environment:
      POSTGRES_BACKUP_MODE: enabled
      POSTGRES_BACKUP_REPOSITORY_TYPE: r2
      PGBACKREST_CONFIG: /run/postgres-backup/pgbackrest.conf
      POSTGRES_INITDB_ARGS: --data-checksums
    command:
      - postgres
      - -c
      - archive_mode=on
      - -c
      - archive_timeout=240s
      - -c
      - archive_command=pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc archive-push %p
    networks:
      postgres-backup-egress:

  postgres-backup:
    image: vibe-postgres:production
    environment:
      POSTGRES_BACKUP_MODE: enabled
      POSTGRES_BACKUP_REPOSITORY_TYPE: r2
      POSTGRES_BACKUP_ENVIRONMENT: production
```

Keep development and staging explicitly `POSTGRES_BACKUP_MODE=disabled`. Do not publish PostgreSQL in production.

Keep `trading-rpc-data` internal in every environment. In development only,
attach PostgreSQL to a dedicated non-internal `postgres-development-host`
bridge so Docker can publish `127.0.0.1:${POSTGRES_HOST_PORT}:5432` without
making the production data network externally routable.

- [ ] **Step 4: Fetch production secrets into host tmpfs**

Implement `sync-production-secrets.sh` with bounded retry for transient AWS
errors and fail-fast handling for authentication/authorization errors. Require
`AWS_REGION` and call:

```bash
aws secretsmanager get-secret-value \
  --secret-id "$POSTGRES_BACKUP_RUNTIME_SECRET_ID" \
  --region "$AWS_REGION" \
  --query SecretString --output text
```

Validate these exact JSON keys with `jq -er`: `POSTGRES_PASSWORD`,
`POSTGRES_REPLICATION_PASSWORD`, `R2_PITR_ACCESS_KEY_ID`,
`R2_PITR_SECRET_ACCESS_KEY`, `R2_ARCHIVE_ACCESS_KEY_ID`,
`R2_ARCHIVE_SECRET_ACCESS_KEY`, and `PGBACKREST_CIPHER_PASSPHRASE`.
Stage every file inside one mode-`0700` generation directory, write files mode
`0600`, then atomically switch the `current` symlink only after the complete
generation validates. Preserve the previous generation on failure and never
print values.

Declare Compose secrets pointing through the absolute `current` symlink. Docker
mounts remain root-owned; the root bootstrap entrypoints copy required values
into service-private tmpfs paths before dropping privileges. Use the private
tmpfs `POSTGRES_PASSWORD_FILE` rather than a production password environment
variable. Store the credential-bearing pgBackRest configuration on tmpfs too.

Implement `ensure-replication-role.sh` using psql variables loaded through a
mode-`0600` temporary PSQLRC, never password-bearing command arguments, stdout,
or string concatenation:

```sql
SELECT format('CREATE ROLE %I WITH LOGIN REPLICATION PASSWORD %L', :'role', :'password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN REPLICATION PASSWORD %L', :'role', :'password') \gexec
```

Verify `rolreplication=true`. Monthly backup connects through the shared Unix
socket and the official image's local replication rule, so the read-only
sidecar never edits `pg_hba.conf` and PostgreSQL never exposes replication on a
host port.

- [ ] **Step 5: Resolve the trading-rpc database URL from a mounted file**

Create `runtime-environment.ts` with this deterministic interface:

```typescript
export type TReadRuntimeFile = (path: string) => string;

export const resolveRuntimeEnvironment = (
  environment: Record<string, string | undefined>,
  readRuntimeFile: TReadRuntimeFile,
): Record<string, string | undefined> => {
  const databaseUrlFile = environment.DATABASE_URL_FILE?.trim();
  if (!databaseUrlFile) return environment;
  return {
    ...environment,
    DATABASE_URL: readRuntimeFile(databaseUrlFile).trim(),
  };
};
```

Test that a file-backed URL overrides an empty/direct Compose value, whitespace
is trimmed, an unreadable file propagates startup failure, and the returned
object is accepted by `parseRuntimeConfig`. In `index.ts`, inject Node's
`readFileSync(path, 'utf8')` from the composition root before calling
`parseRuntimeConfig`.

Have `sync-production-secrets.sh` URL-encode the database password and write
`trading-rpc-database-url`. Mount it root-only at
`/run/secrets/trading-rpc-database-url`; the image entrypoint copies it into
`/run/trading-rpc/secrets/database-url` on tmpfs, changes ownership of both the
private parent and child to UID/GID 1001, and only then drops privileges with
`gosu`. Set `DATABASE_URL_FILE` to the copied tmpfs path and override
`DATABASE_URL` to an empty string so a legacy value from
`.env.production.local` is not retained in the container environment.

- [ ] **Step 6: Make production startup select the complete backend topology**

Add:

```make
DOCKER_PROD_PROFILES := --profile vpc --profile backup
POSTGRES_BACKUP_SECRET_DIR ?= /run/vibe-code-stack/secrets
export POSTGRES_BACKUP_SECRET_DIR

.PHONY: sync-production-backup-secrets
sync-production-backup-secrets:
	@infra/docker/postgres/scripts/sync-production-secrets.sh
```

Make `build-production`, `start-production`, and `stop-production` use
`$(DOCKER_PROD_PROFILES)`; make `start-production` depend on
`sync-production-backup-secrets` and use `up -d --force-recreate` so Compose
rebinds the newly published secret generation. Do not call any deploy command.

- [ ] **Step 7: Validate and commit Compose topology**

Run:

```bash
make check-docker
infra/docker/postgres/tests/development-reachability.smoke.sh
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.prod.yaml \
  --profile vpc --profile backup config --format json > /tmp/compose-prod.json
jq -e '.services.postgres.ports == null and .services["postgres-backup"].ports == null' \
  /tmp/compose-prod.json
pnpm --filter @services/trading-rpc test
pnpm --filter @services/trading-rpc typecheck
```

Expected: all checks pass and neither production database service publishes a port.

```bash
git add Makefile infra/docker/compose.yaml infra/docker/compose.dev.yaml \
  infra/docker/compose.prod.yaml infra/docker/compose.staging.yaml \
  infra/docker/postgres/scripts/ensure-replication-role.sh \
  infra/docker/postgres/scripts/sync-production-secrets.sh \
  infra/docker/postgres/scripts/backup-root-entrypoint.sh \
  infra/docker/postgres/tests/development-reachability.smoke.sh \
  infra/docker/trading-rpc-entrypoint.sh \
  infra/docker/tests/trading-rpc-entrypoint.test.sh \
  infra/docker/secrets/.gitignore \
  services/trading-rpc/src/config/runtime-environment.ts \
  services/trading-rpc/src/config/runtime-environment.test.ts \
  services/trading-rpc/src/index.ts
git commit -m "feat(infra): wire PostgreSQL PITR topology"
```

### Task 3: Implement serialized scheduling, startup reconciliation, and backup health

**Files:**
- Create: `infra/docker/postgres/scripts/backup-entrypoint.sh`
- Create: `infra/docker/postgres/scripts/run-backup-job.sh`
- Create: `infra/docker/postgres/scripts/reconcile-backups.sh`
- Create: `infra/docker/postgres/scripts/backup-health.sh`
- Create: `infra/docker/postgres/scripts/render-backup-crontab.sh`
- Create: `infra/docker/postgres/tests/job-health.test.sh`
- Create: `infra/docker/postgres/tests/backup-crond.test.sh`
- Create: `infra/docker/postgres/tests/runtime-crontab.test.sh`
- Modify: `infra/docker/postgres/config/backup-schedule.cron`
- Modify: `infra/docker/postgres/scripts/backup-root-entrypoint.sh`
- Modify: `infra/docker/compose.yaml`

**Interfaces:**
- Consumes: rendered pgBackRest config, shared socket, state directory, and `pg_stat_archiver`.
- Produces: atomic `health.json`, per-job `last-success.json`/`last-failure.json`, and Docker health exit status.

- [x] **Step 1: Write failing lock and health-threshold tests**

Use a temporary state directory and fake `pgbackrest`/`psql` executables. Assert:

```bash
export POSTGRES_BACKUP_STATE_DIR="$tmp/state"
STATE_DIR=$POSTGRES_BACKUP_STATE_DIR
mkdir -p "$STATE_DIR"
run-backup-job.sh incremental true
jq -e '.status == "success" and .job == "incremental"' \
  "$STATE_DIR/incremental.last-success.json"

jq -n --argjson finished "$(( $(date +%s) - 10800 ))" \
  '{job:"incremental",status:"success",finishedEpochSeconds:$finished}' \
  >"$STATE_DIR/incremental.last-success.json"
if backup-health.sh; then fail 'stale incremental must be unhealthy'; fi
jq -e '.status == "unhealthy" and (.reasons | index("incremental_stale"))' \
  "$STATE_DIR/health.json"
```

Start one fake long full job, invoke an incremental job, and assert the
incremental exits with the documented lock-contention code `75`, records
`status=skipped` rather than `failure`, and does not change the full job's
state. Then start one fake long incremental job, invoke a full job, release the
incremental lock, and assert the full job waits and then executes successfully.
Repeat the waiting assertion for differential, monthly, check, verify,
PITR-drill, and monthly-drill job names.

- [x] **Step 2: Implement `run-backup-job.sh`**

The command contract is:

```text
run-backup-job.sh JOB_NAME COMMAND [ARGUMENT ...]
```

Before locking, sleep a random zero-to-`BACKUP_JITTER_MAX_SECONDS` interval
(default 300 in production and zero in tests/manual commands). Incremental jobs
use `flock -n`; lock contention is a safe skipped recovery point because WAL
continues and the next incremental will run hourly. Full, differential,
monthly, check, verify, PITR-drill, and monthly-drill jobs use
`flock -w "$BACKUP_PRIORITY_LOCK_WAIT_SECONDS"`, default 21,600 seconds. A
priority-job timeout is a failure that makes backup health unhealthy and is
eligible for startup reconciliation; it is never silently skipped. Record
`startedAt`, `finishedAt`, `durationSeconds`, `status`, and safe
`errorCategory` through `jq -n`; write a temporary file and rename atomically.
Preserve the command's nonzero exit code and never put command arguments into
JSON logs.

Run every command in a new session/process group, forward `TERM`, `INT`, and
`HUP` to that group, wait for it to terminate, and publish an `interrupted`
terminal outcome before releasing the lock. Keep `JOB.running.json` until the
terminal outcome has been written atomically so a crash remains recoverable by
startup reconciliation.

- [x] **Step 3: Install the exact UTC schedule**

Create the postgres crontab:

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
5 * * * * /usr/local/bin/postgres-backup/run-backup-job.sh incremental pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=incr backup
0 2 * * 1-6 /usr/local/bin/postgres-backup/run-backup-job.sh differential pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=diff backup
0 2 * * 0 /usr/local/bin/postgres-backup/run-backup-job.sh full pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=full backup
15 */6 * * * /usr/local/bin/postgres-backup/run-backup-job.sh check pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc check
30 3 * * 0 /usr/local/bin/postgres-backup/run-backup-job.sh verify pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc verify
0 4 1 * * /usr/local/bin/postgres-backup/run-backup-job.sh monthly /usr/local/bin/postgres-backup/backup-monthly.sh
0 6 * * 0 /usr/local/bin/postgres-backup/run-backup-job.sh pitr-drill /usr/local/bin/postgres-backup/restore-pitr.sh --latest --drill
30 6 2 * * /usr/local/bin/postgres-backup/run-backup-job.sh monthly-drill /usr/local/bin/postgres-backup/restore-monthly.sh --latest --drill
```

Render these defaults at container start so operators may override an entire
five-field expression without rebuilding the image. Validate cron grammar,
field ranges, lists, ranges, and positive steps before atomically replacing the
last-good crontab. Reject exact timestamp collisions across the supported UTC
schedule horizon.

- [x] **Step 4: Implement startup reconciliation and entrypoint**

`reconcile-backups.sh` reads the last-success state and runs at most one overdue job in this priority: full, differential, incremental, check. It treats missing state as overdue, but first calls `pgbackrest stanza-create` and `pgbackrest check`.

`backup-entrypoint.sh` must:

1. render config;
2. wait for `pg_isready` on the shared Unix socket;
3. run `ensure-replication-role.sh`;
4. create/check the stanza;
5. reconcile overdue jobs;
6. render and validate the runtime crontab;
7. return successfully when invoked with `--prepare-only`.

The root bootstrap owns the runtime crontab directory/file as
`root:postgres` with modes `0750`/`0640`, runs the preparation phase as
`postgres`, then permanently drops to UID/GID 70 with `setpriv`,
`no-new-privileges`, and only `CAP_SETGID` retained for BusyBox cron job setup.
The long-lived scheduler must not be able to read root-owned source secrets or
regain UID 0.

- [x] **Step 5: Implement health evaluation**

`backup-health.sh` constructs `health.json` and exits nonzero when any invariant
fails. Use these exact maximum ages: latest successful physical backup of any
type 7,200 seconds, differential 93,600 seconds, full 691,200 seconds, monthly
3,024,000 seconds, and required drills 691,200/3,024,000 seconds. A running
priority physical-backup job suppresses only the two-hour physical-backup age
failure until its lock timeout; it does not suppress WAL, disk, or prior-job
failures. Fail when a `pg_wal/archive_status/*.ready` file remains pending for
more than 300 seconds or when `pg_stat_archiver.failed_count` increases from the
stored healthy baseline. Do not declare an idle database unhealthy merely
because `last_archived_time` is old. Fail at
`BACKUP_DISK_HIGH_WATER_PERCENT`, default `85`, and reject configured values
outside `1..100`. When `pg_stat_archiver.failed_count` increases, fail two
consecutive health probes (matching Compose `retries: 2`) before advancing the
stored baseline on the following healthy acknowledgement probe.

Configure the Compose healthcheck:

```yaml
healthcheck:
  test: [CMD, /usr/local/bin/gosu, postgres, /usr/local/bin/postgres-backup/backup-health.sh]
  interval: 60s
  timeout: 15s
  retries: 2
  start_period: 10m
```

- [x] **Step 6: Run focused tests and commit**

```bash
make test-postgres-backup-scripts
docker compose -f infra/docker/compose.yaml -f infra/docker/compose.prod.yaml \
  --profile backup config --no-env-resolution --quiet
git add infra/docker/postgres infra/docker/compose.yaml
git commit -m "feat(infra): schedule and monitor PostgreSQL backups"
```

### Task 4: Implement immutable monthly physical archives

**Files:**
- Create: `infra/docker/postgres/scripts/backup-monthly.sh`
- Create: `infra/docker/postgres/tests/monthly-backup.test.sh`
- Modify: `infra/docker/compose.yaml`
- Modify: `infra/docker/compose.prod.yaml`

**Interfaces:**
- Consumes: the dedicated replication role configured in Task 2, archive R2 credentials, `POSTGRES_ARCHIVE_AGE_RECIPIENT`, and staging volume.
- Produces: `staging/BACKUP_ID`, verified `monthly/YYYY/MM/BACKUP_ID`, encrypted artifacts, outer upload manifest, and `_SUCCESS.json` written last.

- [ ] **Step 1: Write the failing publish-order test**

Fake `pg_basebackup`, `age`, and `rclone` into a temporary `PATH`. Append every fake operation to `operations.log`; make the fake remote check fail once. Assert that failure leaves local ciphertext present and never logs `write _SUCCESS.json`. On the successful run assert the final operations are:

```text
upload staging
check-download staging
copy staging monthly
write _SUCCESS.json
check _SUCCESS.json
delete remote staging
delete local staging
```

- [ ] **Step 2: Implement preflight and physical snapshot creation**

Require 1.5 times the previous compressed snapshot size, or `POSTGRES_MONTHLY_MIN_FREE_BYTES` on the first run. Create backup IDs as `YYYYMMDDTHHMMSSZ-` plus the PostgreSQL system identifier. Run:

```bash
pg_basebackup \
  --host=/var/run/postgresql --port=5432 --username=trading_rpc_backup \
  --checkpoint=fast --wal-method=stream --format=tar \
  --compress=zstd:level=3 --manifest-checksums=SHA256 \
  --pgdata="$stage/plain"
```

Create `recovery-manifest.json` with PostgreSQL major version, system identifier, timeline, start/end timestamps, service name, environment, pgBackRest version, pg_basebackup version, and plaintext SHA-256 values.

- [ ] **Step 3: Encrypt and publish safely**

Encrypt each tar and the recovery manifest using:

```bash
age --recipient "$POSTGRES_ARCHIVE_AGE_RECIPIENT" \
  --output "$ciphertext_path" "$plaintext_path"
```

Create `upload-manifest.json` with only backup ID, ciphertext names, sizes, and SHA-256 values. Configure an ephemeral rclone file under `/run/postgres-backup/rclone.conf` with provider `Cloudflare`, private ACL, `no_check_bucket=true`, and the archive token files.

Upload to `staging` through `retry_with_backoff`, run `rclone check --download`
against local ciphertext, copy to `monthly`, upload `_SUCCESS.json` last, read
it back, then clean staging. Never use `rclone sync` or any command that can
delete unrelated prefixes. A failed checksum or exhausted retry preserves local
ciphertext and emits a stable non-secret error category.

- [ ] **Step 4: Run tests and commit**

```bash
make test-postgres-backup-scripts
git add infra/docker/postgres infra/docker/compose*.yaml
git commit -m "feat(infra): add immutable monthly PostgreSQL archives"
```

### Task 5: Implement guarded PITR, monthly restore, and automated restore verification

**Files:**
- Create: `infra/docker/postgres/scripts/restore-pitr.sh`
- Create: `infra/docker/postgres/scripts/restore-monthly.sh`
- Create: `infra/docker/postgres/scripts/restore-verify.sh`
- Create: `infra/docker/postgres/tests/restore-guards.test.sh`
- Modify: `infra/docker/compose.yaml`

**Interfaces:**
- Consumes: `--latest` or RFC3339 `--target-time`, an explicitly new restore directory, backup repositories, and recovery keys.
- Produces: an isolated restored cluster, `restore-result.json`, SQL verification result, and exit `124` when duration exceeds 3,600 seconds.

- [ ] **Step 1: Write destructive-guard tests**

Assert all of these fail before invoking pgBackRest/rclone:

```bash
restore-pitr.sh --target-dir /var/lib/postgresql/18/docker --latest
restore-pitr.sh --target-dir "$non_empty_dir" --latest
restore-pitr.sh --target-dir "$empty_dir" --target-time 'not-a-time'
restore-monthly.sh --target-dir /var/lib/postgresql --latest
```

Assert an empty path under `/var/lib/postgres-backup/stage/restores/` passes validation. Verify scripts never contain `docker`, `docker compose`, or `/var/run/docker.sock` invocations.

- [ ] **Step 2: Implement PITR restore**

Parse RFC3339 timestamps with `date -d`, reject future times, create the target directory mode `0700`, and run:

```bash
pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
  --stanza=trading-rpc \
  --pg1-path="$target_dir" \
  --type=time --target="$target_time" --target-action=promote restore
```

For `--latest`, omit `--type` and `--target` but still restore into the new path. Never set `--delta`. Measure monotonic duration and call `restore-verify.sh`.

- [ ] **Step 3: Implement monthly restore and on-demand identity retrieval**

List only prefixes containing readable `_SUCCESS.json`. Download ciphertext and
`upload-manifest.json`, validate ciphertext SHA-256, fetch
`POSTGRES_BACKUP_RECOVERY_SECRET_ID` with AWS CLI into a mode-`0600` tmpfs
identity file, decrypt, and validate the inner recovery manifest. Extract
`base.tar.zst` into the new target directory and `pg_wal.tar.zst` into its
`pg_wal/` directory; restore any additional tablespace tar explicitly rather
than flattening it. Remove the private identity in a trap on success or failure.

- [ ] **Step 4: Implement isolated PostgreSQL verification**

Start PostgreSQL with no TCP listener and a private socket:

```bash
pg_ctl -D "$target_dir" -o \
  "-c listen_addresses='' -c unix_socket_directories='$socket_dir' -c port=55432" \
  -w start
```

Run `pg_isready`, compare `SHOW server_version_num`, require
`SHOW data_checksums` to return `on`, query the cluster system identifier,
verify `trading_rpc`, `drizzle.__drizzle_migrations`, and
`market_data.market_snapshots`, then execute `SELECT 1`. Stop with
`pg_ctl -m fast -w stop` in a trap. Write `restore-result.json` with backup ID,
target time, duration, checks, and status; fail with `124` after 3,600 seconds.

- [ ] **Step 5: Test and commit**

```bash
make test-postgres-backup-scripts
git add infra/docker/postgres infra/docker/compose.yaml
git commit -m "feat(infra): add guarded PostgreSQL restore drills"
```

### Task 6: Add operator commands and the EC2/R2 recovery runbook

**Files:**
- Modify: `Makefile`
- Modify: `infra/docker/README.md`
- Modify: `infra/docker/secrets/.gitignore`

**Interfaces:**
- Consumes: the Compose backup profile and the scripts from Tasks 1–5.
- Produces: stable `db-backup-*` and `db-restore-*` operator commands with explicit destructive guards.

- [ ] **Step 1: Add Make target contract checks**

Extend `check-docker` to grep the Make database and require these names:

```text
db-backup-info
db-backup-now
db-backup-check
db-backup-verify
db-backup-health
db-restore-latest
db-restore-at
db-restore-drill
test-postgres-backup-integration
```

Expected before implementation: `make check-docker` fails on the first missing target.

- [ ] **Step 2: Add non-destructive backup targets**

Use `docker compose exec postgres-backup` for info, check, verify, and manual full backup. `db-backup-health` prints `/var/lib/postgres-backup/state/health.json` through `jq` and preserves the health script's exit code.

- [ ] **Step 3: Add guarded restore targets**

`db-restore-latest` generates a fresh restore ID and invokes `restore-pitr.sh --latest`. `db-restore-at` requires nonempty `TARGET_TIME`. Neither target accepts a production volume name. Require `CONFIRM_RESTORE=restore-into-new-volume` before either command runs, and print the isolated restore volume name without changing service configuration.

- [ ] **Step 4: Write the production runbook**

Document these exact operational sections in `infra/docker/README.md`:

1. architecture and RPO/RTO limits;
2. required R2 buckets and bucket-scoped tokens;
3. Bucket Lock rule for `monthly/` at 400 days;
4. lifecycle rules for `monthly/` at 400 days and `staging/` at seven days;
5. AWS Secrets Manager JSON keys and EC2 instance-policy scope;
6. one-command production startup;
7. backup inspection and manual backup;
8. PITR latest and target-time recovery;
9. monthly recovery and age key recovery;
10. restore drill evidence and CloudWatch health integration;
11. EC2 disk sizing, including 1.5-times monthly staging headroom;
12. failure procedures for R2 outage, WAL growth, cipher-key loss, and unhealthy backup state.

Use example identifiers only and never include a real token, account ID, hostname secret, or private age identity.

- [ ] **Step 5: Validate docs and commands, then commit**

```bash
make check-docker
make -n db-backup-info db-backup-check db-backup-verify db-backup-health
git diff --check -- Makefile infra/docker/README.md infra/docker/secrets/.gitignore
git add Makefile infra/docker/README.md infra/docker/secrets/.gitignore
git commit -m "docs(infra): add PostgreSQL recovery runbook"
```

### Task 7: Prove real local full/WAL/PITR/monthly recovery and run repository gates

**Files:**
- Create: `infra/docker/compose.backup-test.yaml`
- Create: `infra/docker/postgres/tests/backup-integration.sh`
- Modify: `Makefile`
- Modify: `infra/docker/README.md`

**Interfaces:**
- Consumes: the production-equivalent image/scripts with local repository and local rclone substitutions.
- Produces: repeatable evidence that physical backup, WAL replay, encrypted monthly archive, and both restore paths work without production credentials.

- [ ] **Step 1: Write the failing integration harness**

The harness creates a unique Compose project, generates a disposable age keypair, starts PostgreSQL with local pgBackRest repository mode, and registers cleanup traps. It must fail initially because `compose.backup-test.yaml` does not exist.

- [ ] **Step 2: Add the local integration overlay**

Override repository mode to `posix`, mount `pgbackrest-test-repo`, use an rclone local remote rooted at `postgres-backup-test-archive`, and enable production archive settings including `archive_timeout=240s`. Do not expose R2/AWS credentials and do not reuse the normal development data volume.

- [ ] **Step 3: Implement the real recovery sequence**

The test must perform these observable steps:

```sql
CREATE TABLE public.backup_probe(id integer PRIMARY KEY, value text NOT NULL);
INSERT INTO public.backup_probe VALUES (1, 'before-target');
SELECT clock_timestamp() AS target_time;
INSERT INTO public.backup_probe VALUES (2, 'after-target');
SELECT pg_switch_wal();
```

Start `trading-rpc` once so Drizzle applies its real migrations, then take a full
pgBackRest backup before the probe writes. Capture the `target_time` returned by
the committed first write, perform the later write, wait until WAL is archived,
restore to that timestamp, and assert row `1` exists while row `2` does not.
Then run the monthly physical snapshot, restore it, and assert both rows exist.
Assert every restored PostgreSQL instance starts, the Drizzle journal is
readable, and both restore durations are below 3,600 seconds.

- [ ] **Step 4: Add and run the integration target**

```make
.PHONY: test-postgres-backup-integration
test-postgres-backup-integration:
	@bash infra/docker/postgres/tests/backup-integration.sh
```

Run:

```bash
make test-postgres-backup-scripts
make test-postgres-backup-integration
make check-docker
```

Expected: all backup tests pass and all temporary containers/volumes are removed by the trap.

- [ ] **Step 5: Run the complete Definition of Done**

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
make check-docker
```

Expected: every command exits zero. If a repository-wide failure is unrelated to this branch, capture the exact command/output and do not claim full completion.

- [ ] **Step 6: Run the credential-gated development R2 smoke test**

After the user supplies development bucket credentials, a Cloudflare token that
can read bucket configuration, and an age public recipient, run the backup
profile against development-only R2 buckets. Verify the bucket is private, list
the `monthly/` Bucket Lock and lifecycle rules, then verify pgBackRest
`stanza-create`, `check`, full backup, forced WAL archive, latest restore,
monthly upload, `_SUCCESS.json`, download, decrypt, and restore. Do not create
or mutate production buckets and do not run a deploy command.

- [ ] **Step 7: Commit integration evidence assets**

```bash
git add Makefile infra/docker/compose.backup-test.yaml infra/docker/postgres/tests/backup-integration.sh infra/docker/README.md
git commit -m "test(infra): verify PostgreSQL backup recovery"
```

## Completion Evidence

Before reporting completion, capture:

- pinned tool versions from the built image;
- `docker compose config` evidence that production PostgreSQL has no published port and backup has no Docker socket;
- pgBackRest `info --output=json` showing a valid full backup and WAL range;
- PITR probe showing the expected before/after boundary;
- monthly `_SUCCESS.json` plus successful decrypt/restore evidence;
- health failure evidence for stale WAL and failed upload;
- measured restore durations;
- results of all repository Definition-of-Done commands;
- any credential-gated R2 or EC2 validation gap that remains.
