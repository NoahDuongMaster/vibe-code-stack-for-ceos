#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

image=${POSTGRES_BACKUP_CROND_TEST_IMAGE:-vibe-postgres:crond-test}
docker build --quiet --file "$ROOT/infra/docker/postgres.Dockerfile" \
  --tag "$image" "$ROOT" >/dev/null

docker run --rm --entrypoint /bin/sh "$image" -ec '
  for script in backup-entrypoint.sh backup-health.sh reconcile-backups.sh run-backup-job.sh; do
    test -x "/usr/local/bin/postgres-backup/$script"
  done
'

container_id=''
cleanup() {
  [ -z "$container_id" ] || docker rm --force "$container_id" >/dev/null 2>&1 || true
}
trap cleanup EXIT

container_id=$(docker run --detach \
  --entrypoint /usr/local/bin/postgres-backup/backup-root-entrypoint.sh \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add SETGID \
  --cap-add SETUID \
  --security-opt no-new-privileges:true \
  --tmpfs /run/postgres-backup:rw,noexec,nosuid,nodev,mode=0700,uid=70,gid=70 \
  --tmpfs /run/postgres-backup-secrets:rw,noexec,nosuid,nodev,mode=0700 \
  --env POSTGRES_BACKUP_MODE=disabled \
  "$image" timeout 20 crond -f -c /etc/postgres-backup/crontabs)

process_table=''
for _ in $(seq 1 50); do
  process_table=$(docker top "$container_id" -eo user,pid,args 2>/dev/null || true)
  if printf '%s\n' "$process_table" | grep -Eq 'crond -f -c /etc/postgres-backup/crontabs'; then
    break
  fi
  sleep 0.1
done

printf '%s\n' "$process_table" | grep -Eq \
  '^(postgres|70)[[:space:]].*crond -f -c /etc/postgres-backup/crontabs' || {
  docker logs "$container_id" >&2 || true
  fail 'crond did not remain running as the postgres user under sidecar capabilities'
}
if printf '%s\n' "$process_table" | grep -Eq \
  '^root[[:space:]].*crond -f -c /etc/postgres-backup/crontabs'; then
  fail 'crond remained privileged after the root bootstrap'
fi

printf 'ok - non-root crond runs under exact sidecar capabilities\n'
