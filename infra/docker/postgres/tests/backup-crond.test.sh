#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

image=${POSTGRES_BACKUP_CROND_TEST_IMAGE:-vibe-postgres:crond-test}
docker build --quiet --file "$ROOT/infra/docker/postgres.Dockerfile" \
  --tag "$image" "$ROOT" >/dev/null

docker run --rm --entrypoint /bin/sh "$image" -ec '
  for script in \
    backup-entrypoint.sh backup-health.sh reconcile-backups.sh \
    render-backup-crontab.sh run-backup-job.sh; do
    test -x "/usr/local/bin/postgres-backup/$script"
  done
'

tmp=$(mktemp -d)
container_id=''
cleanup() {
  [ -z "$container_id" ] || docker rm --force "$container_id" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT

cat >"$tmp/health-probe.sh" <<'EOF'
#!/bin/sh
set -eu
install -d -m 0755 /tmp/health-bin /tmp/health-data /tmp/health-spool /tmp/health-stage /tmp/health-wal
cat >/tmp/health-bin/psql <<'PSQL'
#!/bin/sh
printf '0\n'
PSQL
chmod 0755 /tmp/health-bin/psql
gosu postgres sh -ec '
  state=/var/lib/postgres-backup/state
  now=$(date +%s)
  for job in incremental differential full monthly check verify pitr-drill monthly-drill; do
    jq -n --arg job "$job" --argjson now "$now" \
      '\''{job:$job,status:"success",startedAt:"2026-07-15T00:00:00Z",
        finishedAt:"2026-07-15T00:00:01Z",startedEpochSeconds:$now,
        finishedEpochSeconds:$now,durationSeconds:1,errorCategory:"none"}'\'' \
      >"$state/$job.last-success.json"
  done
'
if ! gosu postgres env \
  POSTGRES_BACKUP_STATE_DIR=/var/lib/postgres-backup/state \
  POSTGRES_WAL_ARCHIVE_STATUS_DIR=/tmp/health-wal \
  POSTGRES_DATA_DIR=/tmp/health-data \
  POSTGRES_BACKUP_SPOOL_DIR=/tmp/health-spool \
  POSTGRES_BACKUP_STAGE_DIR=/tmp/health-stage \
  BACKUP_PSQL_BIN=/tmp/health-bin/psql \
  BACKUP_DISK_HIGH_WATER_PERCENT=101 \
  /usr/local/bin/postgres-backup/backup-health.sh; then
  gosu postgres cat /var/lib/postgres-backup/state/health.json >&2
  exit 1
fi
EOF
chmod 0755 "$tmp/health-probe.sh"

docker run --rm \
  --entrypoint /bin/sh \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add SETGID \
  --cap-add SETUID \
  --security-opt no-new-privileges:true \
  --tmpfs /var/lib/postgres-backup/state:rw,noexec,nosuid,nodev,mode=0700,uid=70,gid=70 \
  --mount "type=bind,source=$tmp/health-probe.sh,target=/test-health-probe.sh,readonly" \
  "$image" /test-health-probe.sh
printf 'ok - Compose-equivalent health probe drops to postgres\n'

mkdir -p "$tmp/secrets"
for secret in replication pitr-key pitr-secret archive-key archive-secret cipher; do
  printf '%s-value\n' "$secret" >"$tmp/secrets/$secret"
  chmod 0600 "$tmp/secrets/$secret"
done

cat >"$tmp/prepare-only.sh" <<'EOF'
#!/bin/sh
set -eu
[ "${1:-}" = --prepare-only ]
id -u >/tmp/backup-prepare-uid
env | sort >/tmp/backup-prepare-env
EOF

cat >"$tmp/render-crontab.sh" <<'EOF'
#!/bin/sh
set -eu
output=$1
install -d -o 0 -g 0 -m 0700 "$(dirname -- "$output")"
cat >"$output" <<'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * id -u > /tmp/backup-cron-job-uid && printf '%s' "$TZ" > /tmp/backup-cron-job-tz && env | sort > /tmp/backup-cron-job-env
CRON
chmod 0600 "$output"
EOF
chmod 0755 "$tmp/prepare-only.sh" "$tmp/render-crontab.sh"

container_id=$(docker run --detach \
  --entrypoint /usr/local/bin/postgres-backup/backup-root-entrypoint.sh \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add SETGID \
  --cap-add SETUID \
  --security-opt no-new-privileges:true \
  --tmpfs /run/postgres-backup:rw,noexec,nosuid,nodev,mode=0700,uid=70,gid=70 \
  --tmpfs /run/postgres-backup-secrets:rw,noexec,nosuid,nodev,mode=0700 \
  --tmpfs /run/postgres-backup-cron:rw,noexec,nosuid,nodev,mode=0700 \
  --mount "type=bind,source=$tmp/secrets,target=/run/secrets,readonly" \
  --mount "type=bind,source=$tmp/prepare-only.sh,target=/usr/local/bin/postgres-backup/backup-entrypoint.sh,readonly" \
  --mount "type=bind,source=$tmp/render-crontab.sh,target=/test-render-crontab.sh,readonly" \
  --env POSTGRES_BACKUP_MODE=enabled \
  --env BACKUP_RENDER_CRONTAB_BIN=/test-render-crontab.sh \
  --env POSTGRES_REPLICATION_PASSWORD_SOURCE_FILE=/run/secrets/replication \
  --env R2_PITR_ACCESS_KEY_ID_SOURCE_FILE=/run/secrets/pitr-key \
  --env R2_PITR_SECRET_ACCESS_KEY_SOURCE_FILE=/run/secrets/pitr-secret \
  --env R2_ARCHIVE_ACCESS_KEY_ID_SOURCE_FILE=/run/secrets/archive-key \
  --env R2_ARCHIVE_SECRET_ACCESS_KEY_SOURCE_FILE=/run/secrets/archive-secret \
  --env PGBACKREST_CIPHER_PASSPHRASE_SOURCE_FILE=/run/secrets/cipher \
  "$image" /usr/local/bin/postgres-backup/backup-entrypoint.sh)

process_table=''
for _ in $(seq 1 700); do
  process_table=$(docker top "$container_id" -eo user,pid,args 2>/dev/null || true)
  if docker exec "$container_id" test -s /tmp/backup-cron-job-uid 2>/dev/null; then
    break
  fi
  sleep 0.1
done

printf '%s\n' "$process_table" | grep -Eq \
  '^root[[:space:]].*crond -f -c /run/postgres-backup-cron' || {
  docker logs "$container_id" >&2 || true
  fail 'restricted root crond did not remain running'
}
assert_eq "$(docker exec "$container_id" cat /tmp/backup-prepare-uid)" 70
assert_eq "$(docker exec "$container_id" cat /tmp/backup-cron-job-uid)" 70
assert_eq "$(docker exec "$container_id" cat /tmp/backup-cron-job-tz)" UTC
assert_eq "$(docker exec "$container_id" stat -c '%u:%a' /run/postgres-backup-cron/postgres)" '0:600'
assert_eq "$(docker exec "$container_id" stat -c '%u:%a' /run/postgres-backup-secrets)" '70:700'
docker exec "$container_id" grep -Fq \
  'POSTGRES_REPLICATION_PASSWORD_FILE=/run/postgres-backup-secrets/postgres-replication-password' \
  /tmp/backup-cron-job-env || fail 'runtime secret path was not inherited by postgres cron jobs'
if docker exec "$container_id" grep -Fq '_SOURCE_FILE=' /tmp/backup-cron-job-env; then
  fail 'root scheduler leaked source secret paths into cron job environment'
fi

printf 'ok - restricted root crond executes root-owned schedule jobs as postgres\n'
