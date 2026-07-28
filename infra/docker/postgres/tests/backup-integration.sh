#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
OVERLAY="$ROOT/infra/docker/compose.backup-test.yaml"
BASE_COMPOSE="$ROOT/infra/docker/compose.yaml"
project="vibebackupit$$_${RANDOM:-0}"
runtime_dir=$(mktemp -d)
secret_volume="${project}_source-secrets"
chmod 0755 "$runtime_dir"
export POSTGRES_BACKUP_TEST_RUNTIME_DIR="$runtime_dir"
export POSTGRES_BACKUP_TEST_AGE_RECIPIENT=
export POSTGRES_BACKUP_TEST_SECRET_VOLUME="$secret_volume"

compose=(
  docker compose
  --project-name "$project"
  --file "$BASE_COMPOSE"
  --file "$OVERLAY"
  --profile backup
  --profile vpc
)

cleanup() {
  local status=$?

  trap - EXIT INT TERM
  if [ "$status" -ne 0 ]; then
    "${compose[@]}" ps >&2 2>/dev/null || true
    "${compose[@]}" logs --tail 120 postgres postgres-backup trading-rpc \
      >&2 2>/dev/null || true
  fi
  "${compose[@]}" down --volumes --remove-orphans --timeout 5 \
    >/dev/null 2>&1 || true
  docker volume rm --force "$secret_volume" >/dev/null 2>&1 || true
  rm -rf -- "$runtime_dir"
  exit "$status"
}
trap cleanup EXIT INT TERM

[ -f "$OVERLAY" ] || {
  printf 'missing local backup integration overlay: %s\n' "$OVERLAY" >&2
  exit 1
}

mkdir -p "$runtime_dir/bin" "$runtime_dir/secrets"
for secret_name in \
  postgres-replication-password \
  r2-pitr-access-key-id r2-pitr-secret-access-key \
  r2-archive-access-key-id r2-archive-secret-access-key \
  pgbackrest-cipher-passphrase; do
  printf 'integration-%s\n' "$secret_name" >"$runtime_dir/secrets/$secret_name"
  chmod 0600 "$runtime_dir/secrets/$secret_name"
done

cat >"$runtime_dir/bin/rclone-local" <<'RCLONE'
#!/usr/bin/env bash
set -Eeuo pipefail

remote_root=/var/lib/postgres-backup-test-archive
[ "${1:-}" = --config ] || exit 64
shift 2
command=${1:-}
[ -n "$command" ] || exit 64
shift

remote_path() {
  local value=$1
  local relative

  case "$value" in
    r2:*)
      relative=${value#r2:}
      relative=${relative#*/}
      [[ "/$relative/" != *'/../'* ]] || exit 64
      printf '%s/%s' "$remote_root" "$relative"
      ;;
    *) printf '%s' "$value" ;;
  esac
}

copy_directory() {
  local source=$1
  local destination=$2

  mkdir -p "$destination"
  cp -a "$source"/. "$destination"/
}

compare_directories() {
  local source=$1
  local destination=$2
  local relative

  while IFS= read -r relative; do
    [ -f "$destination/$relative" ] || return 1
    cmp -s -- "$source/$relative" "$destination/$relative" || return 1
  done < <(cd "$source" && find . -type f -print | sed 's#^./##' | sort)
  diff -u \
    <(cd "$source" && find . -type f -print | sed 's#^./##' | sort) \
    <(cd "$destination" && find . -type f -print | sed 's#^./##' | sort) \
    >/dev/null
}

case "$command" in
  lsf)
    source=$(remote_path "$1")
    [ -d "$source" ] || exit 0
    if printf '%s\n' "$*" | grep -Fq '_SUCCESS.json'; then
      (cd "$source" && find . -type f -name _SUCCESS.json -print | \
        sed 's#^./##' | sort)
    else
      (cd "$source" && find . -mindepth 1 -maxdepth 1 -print | \
        sed 's#^./##' | sort)
    fi
    ;;
  copy)
    source=$1
    destination=$2
    if [[ "$source" = r2:* ]]; then source=$(remote_path "$source"); fi
    if [[ "$destination" = r2:* ]]; then destination=$(remote_path "$destination"); fi
    copy_directory "$source" "$destination"
    ;;
  check)
    source=$1
    destination=$2
    if [[ "$source" = r2:* ]]; then source=$(remote_path "$source"); fi
    if [[ "$destination" = r2:* ]]; then destination=$(remote_path "$destination"); fi
    compare_directories "$source" "$destination"
    ;;
  copyto)
    source=$1
    destination=$2
    if [[ "$source" = r2:* ]]; then source=$(remote_path "$source"); fi
    if [[ "$destination" = r2:* ]]; then destination=$(remote_path "$destination"); fi
    mkdir -p "$(dirname -- "$destination")"
    if [ -e "$destination" ]; then
      cmp -s -- "$source" "$destination" || exit 65
    else
      cp -- "$source" "$destination"
    fi
    ;;
  cat)
    source=$(remote_path "$1")
    cat -- "$source"
    ;;
  deletefile)
    target=$(remote_path "$1")
    [[ "$1" == *'/staging/'* ]] || exit 66
    rm -f -- "$target"
    ;;
  rmdir)
    target=$(remote_path "$1")
    [[ "$1" == *'/staging/'* ]] || exit 66
    rmdir -- "$target"
    ;;
  *) exit 64 ;;
esac
RCLONE

cat >"$runtime_dir/bin/aws-local" <<'AWS'
#!/usr/bin/env bash
set -Eeuo pipefail

case "${1:-} ${2:-}" in
  'kms generate-mac')
    printf '%s\n' '{"KeyId":"arn:aws:kms:us-east-1:123456789012:key/00000000-0000-4000-8000-000000000001","Mac":"aW50ZWdyYXRpb24tbWFj","MacAlgorithm":"HMAC_SHA_256"}'
    ;;
  'kms verify-mac') printf 'True\n' ;;
  'secretsmanager get-secret-value') cat /test-runtime/age-identity ;;
  *) exit 64 ;;
esac
AWS

chmod 0755 "$runtime_dir/bin/rclone-local" "$runtime_dir/bin/aws-local"

"${compose[@]}" config --no-env-resolution --quiet
"${compose[@]}" build postgres trading-rpc

# A Linux bind mount preserves the host runner's UID. The backup container
# intentionally lacks DAC_OVERRIDE, so a root bootstrap cannot read a host-owned
# 0600 fixture. Stream the fixtures into a Docker volume to reproduce the
# root-owned, 0600 source-secret contract used on the EC2 hosts.
docker volume create "$secret_volume" >/dev/null
tar -C "$runtime_dir/secrets" -cf - . | docker run --rm --interactive \
  --volume "$secret_volume:/source-secrets" \
  --entrypoint /bin/sh \
  vibe-postgres:backup-test -Eeuc '
    tar -xf - -C /source-secrets
    chown 0:0 /source-secrets/*
    chmod 0600 /source-secrets/*
  '

docker run --rm \
  --volume "$runtime_dir:/test-runtime" \
  --entrypoint /bin/bash \
  vibe-postgres:backup-test -Eeuo pipefail -c '
    age-keygen --output /test-runtime/age-identity-full 2>/dev/null
    grep "^AGE-SECRET-KEY-" /test-runtime/age-identity-full \
      > /test-runtime/age-identity
    age-keygen --y /test-runtime/age-identity > /test-runtime/age-recipient
    chmod 0644 /test-runtime/age-identity /test-runtime/age-recipient
    rm -f /test-runtime/age-identity-full
  '
POSTGRES_BACKUP_TEST_AGE_RECIPIENT=$(cat "$runtime_dir/age-recipient")
export POSTGRES_BACKUP_TEST_AGE_RECIPIENT

wait_healthy() {
  local service=$1
  local container_id
  local health

  for _ in $(seq 1 120); do
    container_id=$("${compose[@]}" ps --quiet "$service")
    if [ -n "$container_id" ]; then
      health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$container_id")
      [ "$health" = healthy ] && return 0
      [ "$health" != exited ] || return 1
    fi
    sleep 1
  done
  printf '%s did not become healthy\n' "$service" >&2
  return 1
}

backup_exec() {
  "${compose[@]}" exec --no-TTY --user postgres \
    --env POSTGRES_REPLICATION_PASSWORD_FILE=/run/postgres-backup-secrets/postgres-replication-password \
    --env R2_ARCHIVE_ACCESS_KEY_ID_FILE=/run/postgres-backup-secrets/r2-archive-access-key-id \
    --env R2_ARCHIVE_SECRET_ACCESS_KEY_FILE=/run/postgres-backup-secrets/r2-archive-secret-access-key \
    postgres-backup env \
      -u POSTGRES_REPLICATION_PASSWORD_SOURCE_FILE \
      -u R2_PITR_ACCESS_KEY_ID_SOURCE_FILE \
      -u R2_PITR_SECRET_ACCESS_KEY_SOURCE_FILE \
      -u R2_ARCHIVE_ACCESS_KEY_ID_SOURCE_FILE \
      -u R2_ARCHIVE_SECRET_ACCESS_KEY_SOURCE_FILE \
      -u PGBACKREST_CIPHER_PASSPHRASE_SOURCE_FILE \
      -u PGBACKREST_CIPHER_PASSPHRASE_FILE \
      "$@"
}

"${compose[@]}" up --detach postgres
wait_healthy postgres
"${compose[@]}" up --detach postgres-backup
"${compose[@]}" exec --no-TTY --user root postgres-backup \
  chown postgres:postgres /var/lib/postgres-backup-test-archive
for _ in $(seq 1 120); do
  if backup_exec \
    pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
    --stanza=trading-rpc check >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
backup_exec \
  pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
  --stanza=trading-rpc check >/dev/null

"${compose[@]}" up --detach trading-rpc
wait_healthy trading-rpc

# Starting the real service once applies the checked-in Drizzle migrations.
"${compose[@]}" exec --no-TTY postgres \
  psql --username trading_rpc --dbname trading_rpc --tuples-only --no-align \
  --command "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL" | \
  grep -qx t

backup_exec \
  /usr/local/bin/postgres-backup/run-backup-job.sh full \
  pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
  --stanza=trading-rpc --type=full backup

"${compose[@]}" exec --no-TTY postgres psql \
  --username trading_rpc --dbname trading_rpc --set ON_ERROR_STOP=1 \
  --command 'CREATE TABLE public.backup_probe(id integer PRIMARY KEY, value text NOT NULL)'
"${compose[@]}" exec --no-TTY postgres psql \
  --username trading_rpc --dbname trading_rpc --set ON_ERROR_STOP=1 \
  --command "INSERT INTO public.backup_probe VALUES (1, 'before-target')"
sleep 1
target_time=$("${compose[@]}" exec --no-TTY postgres psql \
  --username trading_rpc --dbname trading_rpc --tuples-only --no-align \
  --set ON_ERROR_STOP=1 \
  --command "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")
target_time=$(printf '%s\n' "$target_time" | tail -n 1 | tr -d '[:space:]')
[[ "$target_time" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] || {
  printf 'invalid PITR target timestamp: %s\n' "$target_time" >&2
  exit 1
}
printf 'PITR target: %s\n' "$target_time"

"${compose[@]}" exec --no-TTY postgres psql \
  --username trading_rpc --dbname trading_rpc --set ON_ERROR_STOP=1 \
  --command "INSERT INTO public.backup_probe VALUES (2, 'after-target'); SELECT pg_switch_wal();"
backup_exec \
  pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
  --stanza=trading-rpc check >/dev/null

pitr_target=/var/lib/postgres-backup/stage/restores/pitr-boundary
backup_exec \
  /usr/local/bin/postgres-backup/restore-pitr.sh \
  --target-dir "$pitr_target" --target-time "$target_time"

query_restored_probe() {
  local target=$1
  local port=$2

  backup_exec env RESTORED_TARGET="$target" RESTORED_PORT="$port" \
    /bin/bash -Eeuo pipefail -c '
      socket=$(mktemp -d /run/postgres-backup/integration-query.XXXXXX)
      cleanup_query() {
        pg_ctl -D "$RESTORED_TARGET" -m fast -w stop >/dev/null 2>&1 || true
        rm -rf -- "$socket"
      }
      trap cleanup_query EXIT
      if ! pg_ctl -D "$RESTORED_TARGET" -l "$socket/postgres.log" -o \
        "-c listen_addresses= -c unix_socket_directories=$socket -c port=$RESTORED_PORT -c archive_mode=off -c archive_command=" \
        -w start >/dev/null; then
        cat "$socket/postgres.log" >&2
        exit 1
      fi
      for _ in $(seq 1 300); do
        if [ "$(psql --host "$socket" --port "$RESTORED_PORT" \
          --username trading_rpc --dbname trading_rpc --tuples-only --no-align \
          --command "SELECT pg_is_in_recovery()")" = f ]; then
          break
        fi
        sleep 0.1
      done
      [ "$(psql --host "$socket" --port "$RESTORED_PORT" \
        --username trading_rpc --dbname trading_rpc --tuples-only --no-align \
        --command "SELECT pg_is_in_recovery()")" = f ] || {
        cat "$socket/postgres.log" >&2
        exit 1
      }
      psql --host "$socket" --port "$RESTORED_PORT" \
        --username trading_rpc --dbname trading_rpc --tuples-only --no-align \
        --set ON_ERROR_STOP=1 \
        --command "SELECT count(*) FROM drizzle.__drizzle_migrations" >/dev/null
      if ! psql --host "$socket" --port "$RESTORED_PORT" \
        --username trading_rpc --dbname trading_rpc --tuples-only --no-align \
        --set ON_ERROR_STOP=1 \
        --command "SELECT string_agg(concat_ws(chr(58), id::text, value), chr(44) ORDER BY id) FROM public.backup_probe"; then
        cat "$socket/postgres.log" >&2
        exit 1
      fi
    '
}

pitr_rows=$(query_restored_probe "$pitr_target" 55433 | tr -d '[:space:]')
[ "$pitr_rows" = '1:before-target' ] || {
  printf 'PITR boundary mismatch: %s\n' "$pitr_rows" >&2
  exit 1
}
backup_exec \
  jq -e '.status == "success" and .durationSeconds < 3600' \
  "$pitr_target/restore-result.json" >/dev/null

backup_exec \
  /usr/local/bin/postgres-backup/run-backup-job.sh monthly \
  /usr/local/bin/postgres-backup/backup-monthly.sh
backup_exec \
  find /var/lib/postgres-backup-test-archive/monthly \
  -name _SUCCESS.json -type f -print -quit | grep -q _SUCCESS.json

monthly_target=/var/lib/postgres-backup/stage/restores/monthly-latest
backup_exec \
  /usr/local/bin/postgres-backup/restore-monthly.sh \
  --target-dir "$monthly_target" --latest
monthly_rows=$(query_restored_probe "$monthly_target" 55434 | tr -d '[:space:]')
[ "$monthly_rows" = '1:before-target,2:after-target' ] || {
  printf 'monthly restore mismatch: %s\n' "$monthly_rows" >&2
  exit 1
}
backup_exec \
  jq -e '.status == "success" and .durationSeconds < 3600' \
  "$monthly_target/restore-result.json" >/dev/null

backup_info=$(backup_exec \
  pgbackrest --config=/run/postgres-backup/pgbackrest.conf \
  --stanza=trading-rpc --output=json info)
printf '%s\n' "$backup_info" | jq -e \
  '.[0].status.code == 0 and (.[0].backup | map(select(.type == "full")) | length > 0)' \
  >/dev/null

printf 'ok - real PostgreSQL full/WAL PITR boundary restored row 1 only\n'
printf 'ok - real encrypted monthly archive restored both probe rows\n'
printf 'ok - restore durations are below 3600 seconds\n'
