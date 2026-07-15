# Trading RPC PostgreSQL backup and R2 disaster-recovery design

## Outcome

Protect the production PostgreSQL cluster that will run in Docker on AWS EC2
against host loss, volume loss, operator mistakes, and database corruption. The
system must continuously archive recoverable data outside AWS to private
Cloudflare R2 storage and prove that the backups can actually be restored.

The approved service-level objectives are:

- recovery point objective (RPO): at most five minutes;
- recovery time objective (RTO): at most one hour;
- operational point-in-time recovery (PITR): at least 35 days;
- long-term recovery points: at least 12 monthly physical snapshots;
- expected PostgreSQL cluster size after 12 months: less than 100 GB.

RTO is an evidence-based objective, not a configuration claim. It is considered
met only after a production-like EC2 restore drill completes within 3,600
seconds.

## Selected approach

Use two independent recovery paths:

1. **pgBackRest operational recovery** continuously archives WAL and scheduled
   physical backups to an encrypted R2 repository. This is the normal path for
   latest recovery and PITR within the 35-day window.
2. **Monthly immutable physical snapshots** use PostgreSQL `pg_basebackup`,
   client-side encryption, and a separate R2 bucket protected by Bucket Lock.
   This is the long-term disaster-recovery path if the operational repository
   is deleted, corrupted, or misconfigured.

A `pg_dump`-only design is rejected because logical dumps do not provide
continuous WAL recovery or five-minute RPO. Two pgBackRest repositories are
also rejected for the monthly tier: pgBackRest sends WAL to every configured
repository, which would retain and upload roughly a year of WAL merely to keep
12 monthly physical recovery points.

## Storage architecture

### Operational PITR bucket

Use a private R2 bucket named by deployment configuration, with
`trading-rpc-postgres-pitr` as the documented example.

- Repository type: pgBackRest S3-compatible repository.
- Repository path: environment-specific, for example `/production`.
- Encryption: pgBackRest client-side AES-256-CBC with a long random
  passphrase, in addition to R2 transport and server-side encryption.
- Retention: `repo1-retention-full-type=time` and
  `repo1-retention-full=35`.
- WAL retention follows the oldest retained valid full backup; WAL required by
  an unexpired backup must not be expired independently.
- R2 Bucket Lock is not applied to this bucket. pgBackRest must be able to
  update repository metadata and delete expired backup objects.
- The bucket is not public and is not connected to a custom public domain.

Time-based retention can keep slightly more than 35 days because pgBackRest
does not remove an old full backup until another valid full backup satisfies the
retention window. This safety margin is intentional.

### Monthly archive bucket

Use a second private R2 bucket, with `trading-rpc-postgres-archive` as the
documented example.

- Upload work first enters `staging/<backup-id>/`, which is not locked.
- After upload and remote checksum validation, objects are copied to
  `monthly/<yyyy>/<mm>/<backup-id>/`.
- `_SUCCESS.json` is written last and is the only marker that makes a monthly
  recovery point eligible for restore.
- Bucket Lock protects the `monthly/` prefix for 400 days against deletion and
  overwrite.
- An R2 object lifecycle expires monthly objects after the lock period and
  cleans abandoned `staging/` objects after seven days.
- Because the lock duration includes a safety margin and R2 lifecycle deletion
  is asynchronous, 13 or occasionally 14 snapshots may coexist. The invariant
  is at least 12 usable monthly recovery points, not an exact object count.

R2 bucket names, prefixes, lock rules, and lifecycle rules are infrastructure
configuration. Backup containers receive bucket-scoped data credentials only;
they do not receive permission to alter bucket configuration.

## Runtime components

### PostgreSQL backup image

Create a pinned PostgreSQL 18 image in `infra/docker` and install the exact
pinned pgBackRest release in that image. The PostgreSQL container itself needs
the pgBackRest binary because PostgreSQL executes `archive_command` locally.

The image must retain the upstream non-root `postgres` runtime and must not
embed credentials or configuration values. Development may run the same image
with archiving disabled; the production Compose overlay enables the R2 backup
configuration.

PostgreSQL production settings include:

```text
archive_mode = on
archive_command = pgbackrest --stanza=trading-rpc archive-push %p
archive_timeout = 240s
```

`archive_timeout` is the PostgreSQL WAL segment-switch timeout. It is distinct
from pgBackRest's `archive-timeout`, which controls how long pgBackRest waits for
WAL to reach a repository. The four-minute segment-switch budget leaves one
minute for archive upload before the five-minute RPO is breached. Configuration
alone does not prove RPO; monitoring must detect actual archive lag.

Enable pgBackRest asynchronous archiving with a persistent spool directory.
Use Zstandard compression, repository bundling, block incremental backups, fast
backup start, and bounded parallelism appropriate to the selected EC2 instance.

### Backup scheduler sidecar

Add exactly one `postgres-backup` service in the production Compose topology.
It uses the same pinned PostgreSQL/pgBackRest toolchain and:

- mounts PostgreSQL data read-only;
- mounts the pgBackRest spool and backup staging volumes;
- joins only the private `trading-rpc-data` network plus outbound egress;
- exposes no port;
- does not mount the Docker socket;
- serializes jobs with an OS file lock so scheduled and manual jobs cannot
  overlap;
- writes structured JSON logs and a machine-readable health-state file.

The sidecar can start an isolated temporary PostgreSQL process inside its own
container for restore verification. It does not need to create sibling
containers or control the Docker daemon.

### Dedicated backup role

Monthly `pg_basebackup` connects using a dedicated PostgreSQL login role with
`REPLICATION` privilege, not the application role and not a superuser. Its
network access is limited to the private Docker data network. The credential is
provided as a runtime secret.

## Backup schedule

All schedules use UTC and are configurable without rebuilding images.

| Operation | Default schedule |
| --- | --- |
| WAL archive | Continuous; forced segment switch after 240 seconds of relevant activity |
| pgBackRest incremental | Hourly |
| pgBackRest differential | Daily at 02:00, except the weekly full slot |
| pgBackRest full | Sunday at 02:00 |
| `pgbackrest check` | Every six hours |
| `pgbackrest verify` | Weekly after the full backup |
| Monthly physical archive | First day of the month at 04:00 |
| PITR restore drill | Weekly, outside the full-backup window |
| Monthly archive restore drill | Monthly, after `_SUCCESS.json` exists |

The scheduler applies jitter where simultaneous R2 operations could contend.
A missed run is not silently skipped: startup reconciliation checks backup age
and runs the highest-priority overdue job once PostgreSQL and R2 are healthy.

## Monthly snapshot data flow

The monthly job performs the following transaction-like workflow:

1. Validate PostgreSQL health, R2 connectivity, available staging disk, and
   absence of another backup job.
2. Run `pg_basebackup` as a physical tar backup with Zstandard compression and
   WAL included, using the dedicated replication role.
3. Record PostgreSQL major version, system identifier, timeline, backup start
   and end timestamps, source service, deployment environment, and tool
   versions.
4. Generate a versioned recovery manifest containing SHA-256 checksums of the
   unencrypted artifacts.
5. Encrypt the backup artifacts and recovery manifest client-side to an `age`
   public recipient. The private key is never required to create a backup. Then
   generate a non-sensitive upload manifest containing SHA-256 checksums and
   sizes of the ciphertext objects.
6. Upload encrypted objects and the upload manifest to `staging/<backup-id>/`
   through R2's S3-compatible API, using a supported request checksum so R2
   rejects corrupted transfers.
7. Read remote metadata back, validate ciphertext size and checksum, then
   server-side copy the verified objects into their unique locked `monthly/`
   prefix.
8. Write `_SUCCESS.json` last, validate that it can be read, then remove staging
   and local temporary data.

An incomplete upload never receives `_SUCCESS.json` and is never selected by a
restore command. Local staging data is not deleted before remote verification
succeeds.

The staging volume must have at least 1.5 times the estimated compressed backup
size free before a monthly run begins. A failed preflight is safer than filling
the EC2 root volume or PostgreSQL WAL volume.

## Secret and key management

No R2 credential, database credential, cipher passphrase, or private recovery
key may be committed, stored in Compose YAML, placed in `.env`, or printed in
logs.

Required protected values are:

- R2 PITR access key ID and secret access key;
- R2 archive access key ID and secret access key;
- pgBackRest repository cipher passphrase;
- PostgreSQL replication-role password;
- monthly archive `age` private identity for restore only.

The `age` public recipient is configuration rather than a secret. Production
secret material is sourced from AWS Secrets Manager using the EC2 instance
profile and rendered into a root-owned tmpfs at container startup. pgBackRest
configuration containing credentials is mode `0600` and readable only by the
required runtime user.

The `age` private identity has a second offline recovery-vault copy. Automated
monthly restore drills fetch it into tmpfs on demand and remove it immediately
after the drill. Losing the pgBackRest passphrase or `age` private identity is
equivalent to losing the corresponding backup, so key-recovery testing is part
of the restore drill.

PITR and monthly archive use distinct bucket-scoped R2 tokens. The archive
bucket's lock protects completed monthly objects even if its object-write token
is compromised.

## Restore workflow

### Safety rules

- Restore commands always target a new named volume or an explicitly empty
  staging directory.
- No restore command can overwrite `postgres-data`.
- No restore command stops production, changes `DATABASE_URL`, promotes a
  recovered database into service, or performs cutover automatically.
- Destructive cleanup of a restore volume requires an explicit confirmation
  token naming that volume.
- A recovered instance is reachable only through an isolated Unix socket or an
  unexposed internal port until an operator approves cutover.

### PITR

The operator chooses either the latest valid recovery point or a timestamp.
pgBackRest restores the appropriate physical backup into a fresh volume,
configures PostgreSQL time-target recovery, fetches WAL from R2, and replays WAL
through the selected point. PostgreSQL then starts in the isolated verifier
environment.

Validation includes:

- `pg_isready`;
- PostgreSQL major version and system identifier;
- database and required schema existence;
- Drizzle migration journal consistency;
- representative row counts and read queries;
- absence of recovery or checksum errors.

### Monthly archive

The restore process selects only a prefix with a valid `_SUCCESS.json`,
downloads encrypted artifacts, validates remote and local SHA-256 values,
decrypts them into a fresh staging volume, and starts the matching PostgreSQL
major version. It then runs the same SQL integrity checks as PITR.

### Operator interface

Expose guarded Make targets with documented output and nonzero failure codes:

```text
make db-backup-info
make db-backup-now
make db-backup-check
make db-restore-latest
make db-restore-at TARGET_TIME="2026-07-15 10:30:00+00"
make db-restore-drill
```

`db-restore-latest` and `db-restore-at` create and validate an isolated recovery
volume. Cutover remains a separate, documented incident operation.

## Health and failure handling

The backup sidecar becomes unhealthy and emits a structured error when any of
the following occurs:

- a WAL archive-ready file is pending for more than five minutes;
- `pg_stat_archiver.failed_count` increases;
- the latest incremental backup is older than two hours;
- the latest differential backup is older than 26 hours;
- the latest full backup is older than eight days;
- no successful monthly archive exists within 35 days;
- pgBackRest `check` or `verify` fails;
- the latest required restore drill failed or is overdue;
- the restore drill exceeds 3,600 seconds;
- PostgreSQL WAL, backup spool, or staging disk crosses its configured
  high-water threshold.

Backup failures never expire the last known-good backup. Upload retries use
bounded exponential backoff and preserve enough state for the next scheduler
run to resume or safely restart the job. Authentication errors and repository
identity mismatches are not retried indefinitely.

Structured logs include job ID, backup ID, stanza, repository, phase, duration,
byte counts, and safe error category. They exclude command-line secrets,
connection strings, passphrases, private keys, and raw database errors.

Docker health status and process exit codes provide the local integration point
for EC2/CloudWatch or another external alerting system. Provisioning the chosen
alert transport is outside this implementation, but an unhealthy backup
container must be observable without parsing human-oriented logs.

## Docker and repository layout

Implementation remains under the repository's Docker source of truth:

```text
infra/docker/
  postgres.Dockerfile
  postgres/
    config/
      pgbackrest.conf.template
      postgresql-backup.conf
      backup-schedule.cron
    scripts/
      backup-entrypoint.sh
      backup-health.sh
      backup-monthly.sh
      restore-pitr.sh
      restore-monthly.sh
      restore-verify.sh
```

The base Compose model defines reusable volumes and networks. The production
overlay enables WAL archiving, R2 secrets, the scheduler, and production health
checks. Development does not require real R2 credentials; a test profile uses a
local pgBackRest repository to exercise backup and restore behavior.

Document secret provisioning, R2 bucket configuration, backup inspection,
restore commands, key recovery, and EC2 disk sizing in `infra/docker/README.md`.
Example secret files contain placeholders only and remain ignored by Git.

## Verification and acceptance

### Automated validation

- Validate all shell syntax and test scripts with injected command fakes for
  success, upload failure, checksum failure, stale health state, and guarded
  restore behavior.
- Build the pinned PostgreSQL backup image.
- Validate base, development, staging, and production Compose models.
- Run a local integration sequence: full backup, data mutation, WAL archive,
  timestamped PITR, PostgreSQL start, and SQL verification.
- Run a monthly sequence: physical snapshot, encrypt, upload to a test
  repository, download, checksum, decrypt, restore, and SQL verification.
- Prove that a failed upload never creates `_SUCCESS.json` and never removes
  the only local recoverable artifact.
- Prove that restore refuses a non-empty or production data volume.
- Run repository-wide typecheck, formatting/static checks, lint, tests, build,
  and `make check-docker`.

CI does not receive production R2 credentials. Local-repository integration
tests validate PostgreSQL and pgBackRest semantics; an explicitly credentialed
development R2 smoke test validates S3 compatibility before production use.

### Production readiness gate

Production readiness requires fresh evidence of all of the following:

1. R2 bucket privacy, Bucket Lock, lifecycle, and scoped tokens are verified.
2. A full backup and subsequent WAL are visible in the PITR repository.
3. Recovery to a timestamp after a known write and before a later known write
   produces the expected database state.
4. A monthly archive survives upload, download, checksum, decryption, and
   physical restore.
5. Simulated R2 failure makes the backup container unhealthy without affecting
   PostgreSQL availability or deleting the previous good backup.
6. A production-like EC2 restore drill completes within 3,600 seconds.
7. The offline recovery copy of each encryption key is tested.

## Required deployment inputs

Implementation can scaffold and test the local path without production
credentials. A real development R2 smoke test requires:

- Cloudflare account ID;
- PITR bucket name;
- monthly archive bucket name;
- bucket-scoped R2 access key IDs and secret keys;
- approved R2 bucket location/jurisdiction if not automatic;
- an `age` recovery recipient/public key.

Creating or changing production buckets, locks, lifecycle rules, AWS Secrets
Manager values, EC2 instance profiles, or production Compose state is a
credential-gated infrastructure action and is not performed implicitly.

## Evidence

- PostgreSQL documents continuous WAL archiving and base backups as the basis
  for point-in-time recovery:
  <https://www.postgresql.org/docs/18/continuous-archiving.html>
- PostgreSQL documents physical base-backup creation with `pg_basebackup`:
  <https://www.postgresql.org/docs/18/app-pgbasebackup.html>
- pgBackRest documents encryption, retention, verification, S3-compatible
  repositories, and the absence of a built-in scheduler:
  <https://pgbackrest.org/user-guide.html>
  <https://pgbackrest.org/configuration.html>
  <https://pgbackrest.org/command.html>
- Cloudflare documents R2's S3-compatible endpoint and private object-storage
  behavior:
  <https://developers.cloudflare.com/r2/api/s3/api/>
- Cloudflare documents Bucket Lock and lifecycle rules:
  <https://developers.cloudflare.com/r2/buckets/bucket-locks/>
  <https://developers.cloudflare.com/r2/buckets/object-lifecycles/>
- Cloudflare documents R2 transport and at-rest encryption:
  <https://developers.cloudflare.com/r2/reference/data-security/>
