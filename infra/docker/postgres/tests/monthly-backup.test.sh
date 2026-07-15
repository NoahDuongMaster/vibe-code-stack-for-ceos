#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

monthly_script="$ROOT/infra/docker/postgres/scripts/backup-monthly.sh"
[ -x "$monthly_script" ] || fail 'monthly backup script is missing or not executable'
cleanup_script="$ROOT/infra/docker/postgres/scripts/cleanup-monthly-orphans.sh"
[ -x "$cleanup_script" ] || fail 'monthly plaintext cleanup script is missing'
run_job_script="$ROOT/infra/docker/postgres/scripts/run-backup-job.sh"
old_kms_key_arn='arn:aws:kms:ap-southeast-1:111122223333:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
new_kms_key_arn='arn:aws:kms:ap-southeast-1:111122223333:key/ffffffff-1111-2222-3333-444444444444'

if ! command -v flock >/dev/null 2>&1; then
  [ "${POSTGRES_MONTHLY_TEST_CONTAINER:-}" != 1 ] || \
    fail 'flock is missing from the PostgreSQL backup image'
  image=${POSTGRES_BACKUP_TEST_IMAGE:-vibe-postgres:backup-test}
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker build --quiet --file "$ROOT/infra/docker/postgres.Dockerfile" \
      --tag "$image" "$ROOT" >/dev/null
  fi
  exec docker run --rm \
    --entrypoint /bin/bash \
    --env POSTGRES_MONTHLY_TEST_CONTAINER=1 \
    --mount "type=bind,source=$ROOT,target=/workspace,readonly" \
    --workdir /workspace \
    "$image" /workspace/infra/docker/postgres/tests/monthly-backup.test.sh
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

make_fakes() {
  local case_dir=$1
  local bin_dir="$case_dir/bin"

  mkdir -p "$bin_dir" "$case_dir/remote" "$case_dir/stage" \
    "$case_dir/state" "$case_dir/run"

  cat >"$bin_dir/date" <<'EOF'
#!/usr/bin/env sh
case "$*" in
  '-u +%Y%m%dT%H%M%SZ') printf '%s\n' "${FAKE_BACKUP_TIMESTAMP:-20260715T120000Z}" ;;
  '-u +%Y-%m-%dT%H:%M:%SZ') printf '2026-07-15T12:00:00Z\n' ;;
  *) exec /bin/date "$@" ;;
esac
EOF

  cat >"$bin_dir/df" <<'EOF'
#!/usr/bin/env sh
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf 'fake 999999 1 %s 1%% /stage\n' "${DF_AVAILABLE_KIB:-999999}"
EOF

  cat >"$bin_dir/psql" <<'EOF'
#!/usr/bin/env sh
printf '180004\n'
EOF

  cat >"$bin_dir/pg_controldata" <<'EOF'
#!/usr/bin/env sh
printf 'Database system identifier:           7555555555555555555\n'
printf "Latest checkpoint's TimeLineID:       9\n"
EOF

  cat >"$bin_dir/pg_basebackup" <<'EOF'
#!/usr/bin/env sh
if [ "${1:-}" = --version ]; then
  printf 'pg_basebackup (PostgreSQL) 18.4\n'
  exit 0
fi
target=''
for argument in "$@"; do
  case "$argument" in --pgdata=*) target=${argument#--pgdata=} ;; esac
done
[ -n "$target" ] || exit 64
printf 'pg_basebackup\n' >>"$OPERATIONS_LOG"
mkdir -p "$target"
printf 'compressed-base\n' >"$target/base.tar.zst"
printf 'streamed-wal-is-not-zstd\n' >"$target/pg_wal.tar"
printf '{"PostgreSQL-Backup-Manifest-Version":2,"Files":[{"Path":"base/1","Size":8192}]}\n' >"$target/backup_manifest"
if [ "${PG_BASEBACKUP_KILL_PARENT:-false}" = true ]; then
  kill -KILL "$PPID"
fi
EOF

  cat >"$bin_dir/pgbackrest" <<'EOF'
#!/usr/bin/env sh
printf 'pgBackRest 2.58.0\n'
EOF

  cat >"$bin_dir/age" <<'EOF'
#!/usr/bin/env sh
output=''
input=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --recipient) shift ;;
    --output) output=$2; shift ;;
    *) input=$1 ;;
  esac
  shift
done
[ -n "$output" ] && [ -e "$input" ] || exit 64
printf 'encrypt %s\n' "$(basename "$input")" >>"$OPERATIONS_LOG"
{ printf 'age-encrypted\n'; cat "$input"; } >"$output"
EOF

cat >"$bin_dir/aws" <<'EOF'
#!/usr/bin/env sh
printf 'aws:%s\n' "$*" >>"$OPERATIONS_LOG"
case " $* " in
  *' kms generate-mac '*)
    printf '{"KeyId":"%s","Mac":"ZmFrZS1rbXMtbWFj","MacAlgorithm":"HMAC_SHA_256"}\n' \
      "$FAKE_KMS_KEY_ARN"
    ;;
  *) exit 64 ;;
esac
EOF

  cat >"$bin_dir/rclone" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

[ "$1" = --config ] || exit 64
config=$2
shift 2
command=$1
shift
mode=$(stat -c '%a' "$config" 2>/dev/null || stat -f '%Lp' "$config")
printf 'config-mode %s\n' "$mode" >>"$OPERATIONS_LOG"
grep -Fq 'archive-secret-SHOULD-NOT-LEAK' "$config" || exit 65

remote_path() {
  local value=$1
  case "$value" in
    r2:*)
      value=${value#r2:}
      value=${value#*/}
      printf '%s/%s' "$FAKE_REMOTE_ROOT" "$value"
      ;;
    *) printf '%s' "$value" ;;
  esac
}

compare_directories() {
  local source=$1
  local destination=$2
  local relative
  while IFS= read -r relative; do
    [ -f "$destination/$relative" ] || return 1
    cmp -s "$source/$relative" "$destination/$relative" || return 1
  done < <(cd "$source" && find . -type f -print | sed 's#^./##' | sort)
  diff -u \
    <(cd "$source" && find . -type f -print | sed 's#^./##' | sort) \
    <(cd "$destination" && find . -type f -print | sed 's#^./##' | sort) \
    >/dev/null
}

case "$command" in
  lsf)
    printf 'preflight R2\n' >>"$OPERATIONS_LOG"
    if [ "${RCLONE_PREFLIGHT_MODE:-success}" = fail ]; then
      printf 'AccessDenied: archive bucket access denied\n' >&2
      exit 23
    fi
    ;;
  copy)
    source=$1
    destination=$(remote_path "$2")
    mkdir -p "$destination"
    cp -R "$source"/. "$destination"/
    printf 'upload staging\n' >>"$OPERATIONS_LOG"
    ;;
  check)
    source=$1
    destination=$(remote_path "$2")
    if [[ "$2" == *'/staging/'* ]]; then
      label='check-download staging'
    else
      label='check-download monthly'
    fi
    printf '%s\n' "$label" >>"$OPERATIONS_LOG"
    count=0
    [ ! -f "$RCLONE_CHECK_COUNT_FILE" ] || count=$(cat "$RCLONE_CHECK_COUNT_FILE")
    count=$((count + 1))
    printf '%s' "$count" >"$RCLONE_CHECK_COUNT_FILE"
    case "${RCLONE_CHECK_MODE:-none}" in
      always) printf 'checksum mismatch\n' >&2; exit 9 ;;
      once) [ "$count" -ne 1 ] || { printf 'transient checksum read error\n' >&2; exit 9; } ;;
    esac
    compare_directories "$source" "$destination"
    ;;
  copyto)
    source=$1
    destination=$(remote_path "$2")
    mkdir -p "$(dirname "$destination")"
    if [[ "$source" = r2:* ]]; then
      source=$(remote_path "$source")
      printf 'copy staging monthly\n' >>"$OPERATIONS_LOG"
    elif [[ "$2" == *'/staging/_preflight/'* ]]; then
      printf 'write R2 preflight\n' >>"$OPERATIONS_LOG"
    elif [[ "$2" == *'/_LATEST.json' ]]; then
      printf 'write _LATEST.json\n' >>"$OPERATIONS_LOG"
    elif [[ "$2" == *'/_SUCCESS.json' ]]; then
      printf 'write _SUCCESS.json\n' >>"$OPERATIONS_LOG"
    fi
    [ ! -e "$destination" ] || cmp -s "$source" "$destination" || exit 10
    cp "$source" "$destination"
    ;;
  cat)
    source=$(remote_path "$1")
    if [[ "$1" == *'/staging/_preflight/'* ]]; then
      printf 'check R2 preflight\n' >>"$OPERATIONS_LOG"
    elif [[ "$1" == *'/_LATEST.json' ]]; then
      printf 'check _LATEST.json\n' >>"$OPERATIONS_LOG"
    else
      printf 'check _SUCCESS.json\n' >>"$OPERATIONS_LOG"
    fi
    cat "$source"
    ;;
  deletefile)
    target=$(remote_path "$1")
    [[ "$1" == *'/staging/'* ]] || exit 66
    if [[ "$1" == *'/staging/_preflight/'* ]]; then
      printf 'delete R2 preflight\n' >>"$OPERATIONS_LOG"
    else
      printf 'delete remote staging\n' >>"$OPERATIONS_LOG"
    fi
    rm -f -- "$target"
    ;;
  rmdir)
    target=$(remote_path "$1")
    [[ "$1" == *'/staging/'* ]] || exit 66
    rmdir -- "$target"
    ;;
  *) exit 64 ;;
esac
EOF

  cat >"$bin_dir/sleep" <<'EOF'
#!/usr/bin/env sh
:
EOF

  cat >"$bin_dir/kill-parent" <<'EOF'
#!/usr/bin/env sh
kill -KILL "$PPID"
EOF
  chmod +x "$bin_dir"/*
  printf 'archive-key\n' >"$case_dir/archive-key"
  printf 'archive-secret-SHOULD-NOT-LEAK\n' >"$case_dir/archive-secret"
  printf 'replication-password-SHOULD-NOT-LEAK\n' >"$case_dir/replication-password"
}

run_monthly() {
  local case_dir=$1
  shift

  env \
    PATH="$case_dir/bin:$PATH" \
    OPERATIONS_LOG="$case_dir/operations.log" \
    FAKE_REMOTE_ROOT="$case_dir/remote" \
    RCLONE_CHECK_COUNT_FILE="$case_dir/rclone-check-count" \
    POSTGRES_BACKUP_STAGE_DIR="$case_dir/stage" \
    POSTGRES_BACKUP_STATE_DIR="$case_dir/state" \
    POSTGRES_BACKUP_RUNTIME_DIR="$case_dir/run" \
    POSTGRES_BACKUP_SERVICE_NAME=trading-rpc-example \
    POSTGRES_BACKUP_ENVIRONMENT=production \
    POSTGRES_MONTHLY_MIN_FREE_BYTES=1024 \
    R2_ACCOUNT_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
    R2_ARCHIVE_BUCKET=trading-rpc-postgres-monthly \
    R2_ARCHIVE_ACCESS_KEY_ID_FILE="$case_dir/archive-key" \
    R2_ARCHIVE_SECRET_ACCESS_KEY_FILE="$case_dir/archive-secret" \
    POSTGRES_REPLICATION_PASSWORD_FILE="$case_dir/replication-password" \
    POSTGRES_ARCHIVE_AGE_RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq \
    POSTGRES_BACKUP_KMS_KEY_ID=alias/vibe-postgres-monthly-auth \
    POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS="$old_kms_key_arn,$new_kms_key_arn" \
    FAKE_KMS_KEY_ARN="$old_kms_key_arn" \
    AWS_REGION=ap-southeast-1 \
    "$@" \
    "$monthly_script" >"$case_dir/stdout" 2>"$case_dir/stderr"
}

run_scheduled_monthly() {
  local case_dir=$1
  shift

  env \
    PATH="$case_dir/bin:$PATH" \
    OPERATIONS_LOG="$case_dir/operations.log" \
    FAKE_REMOTE_ROOT="$case_dir/remote" \
    RCLONE_CHECK_COUNT_FILE="$case_dir/rclone-check-count" \
    POSTGRES_BACKUP_STAGE_DIR="$case_dir/stage" \
    POSTGRES_BACKUP_STATE_DIR="$case_dir/state" \
    POSTGRES_BACKUP_RUNTIME_DIR="$case_dir/run" \
    POSTGRES_BACKUP_SERVICE_NAME=trading-rpc-example \
    POSTGRES_BACKUP_ENVIRONMENT=production \
    POSTGRES_MONTHLY_MIN_FREE_BYTES=1024 \
    R2_ACCOUNT_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
    R2_ARCHIVE_BUCKET=trading-rpc-postgres-monthly \
    R2_ARCHIVE_ACCESS_KEY_ID_FILE="$case_dir/archive-key" \
    R2_ARCHIVE_SECRET_ACCESS_KEY_FILE="$case_dir/archive-secret" \
    POSTGRES_REPLICATION_PASSWORD_FILE="$case_dir/replication-password" \
    POSTGRES_ARCHIVE_AGE_RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq \
    POSTGRES_BACKUP_KMS_KEY_ID=alias/vibe-postgres-monthly-auth \
    POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS="$old_kms_key_arn,$new_kms_key_arn" \
    FAKE_KMS_KEY_ARN="$old_kms_key_arn" \
    AWS_REGION=ap-southeast-1 \
    BACKUP_JITTER_MAX_SECONDS=0 \
    "$@" \
    "$run_job_script" monthly "$monthly_script" \
    >"$case_dir/scheduled-stdout" 2>"$case_dir/scheduled-stderr"
}

failure_case="$tmp/failure"
make_fakes "$failure_case"
if run_monthly "$failure_case" RCLONE_CHECK_MODE=always; then
  fail 'remote checksum failure must fail the monthly backup'
fi
[ ! -f "$failure_case/remote/monthly/2026/07/"*/_SUCCESS.json ] || \
  fail 'failed verification published a success marker'
[ ! -f "$failure_case/remote/monthly/2026/07/_LATEST.json" ] || \
  fail 'failed verification published a latest pointer'
if grep -Fq 'write _SUCCESS.json' "$failure_case/operations.log"; then
  fail 'failed verification attempted to publish a success marker'
fi
find "$failure_case/stage" -path '*/cipher/*' -type f | grep -q . || \
  fail 'failed monthly backup did not preserve local ciphertext'
if find "$failure_case/stage" -path '*/plain/*' -type f | grep -q .; then
  fail 'failed monthly backup retained plaintext artifacts'
fi
[ ! -e "$failure_case/state/monthly.last-size.json" ] || \
  fail 'failed monthly backup advanced successful size state'
if grep -Fq 'SHOULD-NOT-LEAK' "$failure_case/stdout" "$failure_case/stderr" \
  "$failure_case/operations.log"; then
  fail 'monthly backup output leaked a credential'
fi
assert_eq "$(grep -c '^check-download staging$' "$failure_case/operations.log")" 4
printf 'ok - failed verification preserves ciphertext without publishing success\n'

success_case="$tmp/success"
make_fakes "$success_case"
run_monthly "$success_case" RCLONE_CHECK_MODE=once

success_marker=$(find "$success_case/remote/monthly" -name _SUCCESS.json -type f)
[ -f "$success_marker" ] || fail 'successful monthly backup has no success marker'
monthly_dir=$(dirname "$success_marker")
[ -f "$monthly_dir/base.tar.zst.age" ] || fail 'base tar ciphertext is missing'
[ -f "$monthly_dir/pg_wal.tar.age" ] || \
  fail 'streamed WAL tar ciphertext must preserve its real uncompressed name'
[ -f "$monthly_dir/backup_manifest.age" ] || fail 'PostgreSQL manifest is missing'
[ -f "$monthly_dir/recovery-manifest.json.age" ] || fail 'recovery manifest is missing'
[ -f "$monthly_dir/upload-manifest.json" ] || fail 'upload manifest is missing'
assert_eq "$(jq -r '.backupId' "$success_marker")" \
  '20260715T120000Z-7555555555555555555'
assert_eq "$(jq -r '.authentication.scheme' "$success_marker")" \
  aws-kms-hmac-sha256
assert_eq "$(jq -r '.authentication.keyId' "$success_marker")" \
  "$old_kms_key_arn"
latest_pointer="$success_case/remote/monthly/2026/07/_LATEST.json"
[ -f "$latest_pointer" ] || fail 'successful monthly backup has no latest pointer'
cmp -s "$success_marker" "$latest_pointer" || \
  fail 'monthly latest pointer does not match the authenticated success marker'
signed_claim="$success_case/signed-claim.json"
jq -er '.signedPayloadBase64 | @base64d | fromjson' "$success_marker" \
  >"$signed_claim"
assert_eq "$(jq -r '.backupId' "$signed_claim")" \
  '20260715T120000Z-7555555555555555555'
assert_eq "$(jq -r '.expandedBytes' "$signed_claim")" 8192
assert_file_contains "$success_case/operations.log" 'aws:kms generate-mac'
assert_eq "$(jq -r '.artifactBytes > 0' "$success_case/state/monthly.last-size.json")" true
if find "$success_case/stage" -mindepth 1 -print | grep -q .; then
  fail 'successful monthly backup retained local staging data'
fi
assert_eq "$(grep -c '^check-download staging$' "$success_case/operations.log")" 2
assert_eq "$(grep -m1 '^config-mode ' "$success_case/operations.log")" 'config-mode 600'
preflight_write_line=$(grep -n -m1 '^write R2 preflight$' \
  "$success_case/operations.log" | cut -d: -f1)
preflight_check_line=$(grep -n -m1 '^check R2 preflight$' \
  "$success_case/operations.log" | cut -d: -f1)
preflight_delete_line=$(grep -n -m1 '^delete R2 preflight$' \
  "$success_case/operations.log" | cut -d: -f1)
basebackup_line=$(grep -n -m1 '^pg_basebackup$' \
  "$success_case/operations.log" | cut -d: -f1)
[ "$preflight_write_line" -lt "$preflight_check_line" ] && \
  [ "$preflight_check_line" -lt "$preflight_delete_line" ] && \
  [ "$preflight_delete_line" -lt "$basebackup_line" ] || \
  fail 'R2 read/write/delete preflight did not complete before pg_basebackup'
if grep -Eq '(run|retry)_rclone (sync|purge|delete) ' "$monthly_script"; then
  fail 'monthly publishing used a broad destructive rclone operation'
fi
if grep -Fq 'SHOULD-NOT-LEAK' "$success_case/stdout" "$success_case/stderr" \
  "$success_case/operations.log" "$monthly_dir/upload-manifest.json"; then
  fail 'successful monthly backup leaked a credential'
fi

upload_line=$(grep -n -m1 '^upload staging$' "$success_case/operations.log" | cut -d: -f1)
staging_check_line=$(grep -n '^check-download staging$' "$success_case/operations.log" | tail -1 | cut -d: -f1)
copy_line=$(grep -n -m1 '^copy staging monthly$' "$success_case/operations.log" | cut -d: -f1)
monthly_check_line=$(grep -n -m1 '^check-download monthly$' "$success_case/operations.log" | cut -d: -f1)
success_write_line=$(grep -n -m1 '^write _SUCCESS.json$' "$success_case/operations.log" | cut -d: -f1)
success_check_line=$(grep -n -m1 '^check _SUCCESS.json$' "$success_case/operations.log" | cut -d: -f1)
latest_write_line=$(grep -n -m1 '^write _LATEST.json$' "$success_case/operations.log" | cut -d: -f1)
latest_check_line=$(grep -n -m1 '^check _LATEST.json$' "$success_case/operations.log" | cut -d: -f1)
delete_line=$(grep -n -m1 '^delete remote staging$' "$success_case/operations.log" | cut -d: -f1)
[ "$upload_line" -lt "$staging_check_line" ] && \
  [ "$staging_check_line" -lt "$copy_line" ] && \
  [ "$copy_line" -lt "$monthly_check_line" ] && \
  [ "$monthly_check_line" -lt "$success_write_line" ] && \
  [ "$success_write_line" -lt "$success_check_line" ] && \
  [ "$success_check_line" -lt "$latest_write_line" ] && \
  [ "$latest_write_line" -lt "$latest_check_line" ] && \
  [ "$latest_check_line" -lt "$delete_line" ] || \
  fail 'monthly archive publish order is unsafe'
if tail -n "+$((success_write_line + 1))" "$success_case/operations.log" | \
  grep -Fq 'copy staging monthly'; then
  fail '_SUCCESS.json was not the final monthly-prefix write'
fi

tail -n +2 "$monthly_dir/recovery-manifest.json.age" >"$success_case/recovery.json"
assert_eq "$(jq -r '.serviceName + ":" + .environment' "$success_case/recovery.json")" \
  'trading-rpc-example:production'
jq -e '.artifacts | map(.name) | index("pg_wal.tar")' \
  "$success_case/recovery.json" >/dev/null || \
  fail 'recovery manifest does not describe the real WAL tar filename'
jq -e '.artifacts | all(has("name") and has("sizeBytes") and has("sha256"))' \
  "$monthly_dir/upload-manifest.json" >/dev/null || \
  fail 'upload manifest does not contain ciphertext integrity metadata'
printf 'ok - monthly archive publishes verified immutable artifacts in safe order\n'

capacity_case="$tmp/capacity"
make_fakes "$capacity_case"
jq -n '{artifactBytes:4096}' >"$capacity_case/state/monthly.last-size.json"
if run_monthly "$capacity_case" DF_AVAILABLE_KIB=5; then
  fail 'monthly backup must require 1.5 times the previous artifact size'
fi
[ ! -e "$capacity_case/operations.log" ] || \
  ! grep -Fq pg_basebackup "$capacity_case/operations.log" || \
  fail 'capacity preflight ran pg_basebackup'
grep -Fq 'capacity_preflight_failed' "$capacity_case/stderr" || \
  fail 'capacity preflight emitted a stale failure category'
printf 'ok - monthly staging capacity is enforced before backup\n'

r2_case="$tmp/r2-preflight"
make_fakes "$r2_case"
if run_monthly "$r2_case" RCLONE_PREFLIGHT_MODE=fail; then
  fail 'R2 connectivity failure must stop before pg_basebackup'
fi
grep -Fq 'preflight R2' "$r2_case/operations.log" || \
  fail 'monthly backup did not probe the archive bucket'
if grep -Fq pg_basebackup "$r2_case/operations.log"; then
  fail 'R2 connectivity failure ran pg_basebackup'
fi
assert_eq "$(grep -c '^preflight R2$' "$r2_case/operations.log")" 1
grep -Fq 'r2_preflight_failed' "$r2_case/stderr" || \
  fail 'R2 connectivity failure category is not actionable'

missing_credential_case="$tmp/missing-credential"
make_fakes "$missing_credential_case"
rm -f "$missing_credential_case/archive-key"
if run_monthly "$missing_credential_case"; then
  fail 'missing R2 credential must stop before pg_basebackup'
fi
[ ! -e "$missing_credential_case/operations.log" ] || \
  ! grep -Fq pg_basebackup "$missing_credential_case/operations.log" || \
  fail 'missing R2 credential ran pg_basebackup'
grep -Fq 'rclone_config_failed' "$missing_credential_case/stderr" || \
  fail 'missing R2 credential category is not actionable'

scheduled_category_case="$tmp/scheduled-category"
make_fakes "$scheduled_category_case"
rm -f "$scheduled_category_case/archive-key"
if run_scheduled_monthly "$scheduled_category_case"; then
  fail 'scheduled monthly backup unexpectedly ignored a missing credential'
fi
assert_eq "$(jq -r '.errorCategory' \
  "$scheduled_category_case/state/monthly.last-failure.json")" \
  rclone_config_failed
[ ! -e "$scheduled_category_case/state/monthly.command-error-category.json" ] || \
  fail 'scheduled monthly backup retained the category handoff file'
printf 'ok - R2 credentials and connectivity are preflighted before snapshot\n'

crash_case="$tmp/crash"
make_fakes "$crash_case"
if run_scheduled_monthly "$crash_case" PG_BASEBACKUP_KILL_PARENT=true; then
  fail 'SIGKILL seam unexpectedly completed the monthly backup'
fi
if find "$crash_case/stage" -path '*/plain' -type d | grep -q .; then
  fail 'scheduled wrapper retained plaintext after a child-only SIGKILL'
fi

crash_backup_dir="$crash_case/stage/20260715T125500Z-7555555555555555555"
mkdir -p "$crash_backup_dir/plain" "$crash_backup_dir/cipher"
printf 'plaintext\n' >"$crash_backup_dir/plain/base.tar.zst"
printf 'preserve-ciphertext\n' >"$crash_backup_dir/cipher/sentinel.age"
mkdir -p "$crash_case/stage/not-a-backup/plain"
printf 'do-not-touch\n' >"$crash_case/stage/not-a-backup/plain/sentinel"
printf 'AGE-SECRET-KEY-1ORPHAN\n' \
  >"$crash_case/run/monthly-age-identity.hard-crash"
printf 'preserve\n' >"$crash_case/run/not-a-restore-secret"
POSTGRES_BACKUP_STAGE_DIR="$crash_case/stage" \
POSTGRES_BACKUP_STATE_DIR="$crash_case/state" \
POSTGRES_BACKUP_RUNTIME_DIR="$crash_case/run" \
  "$cleanup_script" >/dev/null
[ ! -e "$crash_backup_dir/plain" ] || \
  fail 'startup cleanup retained plaintext from a hard-crashed monthly backup'
[ -f "$crash_backup_dir/cipher/sentinel.age" ] || \
  fail 'startup cleanup removed preserved ciphertext'
[ -f "$crash_case/stage/not-a-backup/plain/sentinel" ] || \
  fail 'startup cleanup escaped the exact monthly backup-id namespace'
[ ! -e "$crash_case/run/monthly-age-identity.hard-crash" ] || \
  fail 'startup cleanup retained a hard-crashed monthly recovery identity'
[ -f "$crash_case/run/not-a-restore-secret" ] || \
  fail 'startup cleanup removed an unrelated runtime file'

restore_root="$crash_case/restores"
pitr_restore_orphan="$restore_root/pitr-drill-20260715T120000Z-101"
pitr_tablespace_orphan="$pitr_restore_orphan.tablespaces"
monthly_restore_orphan="$restore_root/monthly-drill-20260715T120000Z-102"
manual_restore="$restore_root/manual-pitr-keep"
mkdir -p "$pitr_restore_orphan" "$pitr_tablespace_orphan" \
  "$monthly_restore_orphan" "$manual_restore"
POSTGRES_BACKUP_STAGE_DIR="$crash_case/stage" \
POSTGRES_BACKUP_STATE_DIR="$crash_case/state" \
POSTGRES_BACKUP_RUNTIME_DIR="$crash_case/run" \
POSTGRES_RESTORE_ROOT="$restore_root" \
POSTGRES_RESTORE_ORPHAN_MIN_AGE_SECONDS=3600 \
  "$cleanup_script" >/dev/null
[ -d "$pitr_restore_orphan" ] || \
  fail 'restore cleanup removed a drill younger than its age guard'
touch -d '2 hours ago' "$pitr_restore_orphan" "$pitr_tablespace_orphan" \
  "$monthly_restore_orphan"
POSTGRES_BACKUP_STAGE_DIR="$crash_case/stage" \
POSTGRES_BACKUP_STATE_DIR="$crash_case/state" \
POSTGRES_BACKUP_RUNTIME_DIR="$crash_case/run" \
POSTGRES_RESTORE_ROOT="$restore_root" \
POSTGRES_RESTORE_ORPHAN_MIN_AGE_SECONDS=3600 \
  "$cleanup_script" >/dev/null
[ ! -e "$pitr_restore_orphan" ] && [ ! -e "$pitr_tablespace_orphan" ] && \
  [ ! -e "$monthly_restore_orphan" ] || \
  fail 'restore cleanup retained hard-killed drill directories'
[ -d "$manual_restore" ] || \
  fail 'restore cleanup escaped the exact drill directory namespace'
for drill_name in pitr-drill monthly-drill; do
  drill_evidence="$crash_case/state/$drill_name.last-result.json"
  jq -e '.status == "failure" and
    .errorCategory == "restore_orphan_reclaimed" and
    (.orphanAgeSeconds >= 3600) and (.reclaimedAt | type == "string")' \
    "$drill_evidence" >/dev/null || \
    fail "restore cleanup did not persist durable $drill_name failure evidence"
done
wrapped_pitr_orphan="$restore_root/pitr-drill-20260715T130000Z-103"
mkdir -p "$wrapped_pitr_orphan"
env \
  POSTGRES_BACKUP_STAGE_DIR="$crash_case/stage" \
  POSTGRES_BACKUP_STATE_DIR="$crash_case/state" \
  POSTGRES_BACKUP_RUNTIME_DIR="$crash_case/run" \
  POSTGRES_RESTORE_ROOT="$restore_root" \
  POSTGRES_RESTORE_ORPHAN_MIN_AGE_SECONDS=0 \
  BACKUP_JITTER_MAX_SECONDS=0 \
  "$run_job_script" pitr-drill true >/dev/null
[ ! -e "$wrapped_pitr_orphan" ] || \
  fail 'scheduled PITR wrapper did not reconcile its hard-kill orphan'

published_crash_case="$tmp/published-crash"
make_fakes "$published_crash_case"
if run_scheduled_monthly "$published_crash_case" \
  BACKUP_AFTER_MONTHLY_PUBLISHED_MARKER_HOOK="$published_crash_case/bin/kill-parent"; then
  fail 'post-publication SIGKILL seam unexpectedly completed the monthly backup'
fi
find "$published_crash_case/remote/monthly" -name _SUCCESS.json -type f | \
  grep -q . || fail 'post-publication crash did not reproduce a verified remote backup'
if find "$published_crash_case/stage" -path '*/cipher/*' -type f | grep -q .; then
  fail 'scheduled wrapper retained already-published local ciphertext'
fi
if find "$published_crash_case/stage" \
  -name .remote-success-verified.json -type f | grep -q .; then
  fail 'scheduled wrapper retained the verified-publication marker'
fi
assert_eq "$(jq -r '.artifactBytes > 0' \
  "$published_crash_case/state/monthly.last-size.json")" true

ambiguous_crash_case="$tmp/ambiguous-crash"
make_fakes "$ambiguous_crash_case"
if run_scheduled_monthly "$ambiguous_crash_case" \
  BACKUP_BEFORE_MONTHLY_VERIFIED_MARKER_HOOK="$ambiguous_crash_case/bin/kill-parent"; then
  fail 'remote/local commit ambiguity seam unexpectedly completed the backup'
fi
ambiguous_backup_dir=$(find "$ambiguous_crash_case/stage" \
  -mindepth 1 -maxdepth 1 -type d | head -1)
[ -f "$ambiguous_backup_dir/.remote-success-pending.json" ] || \
  fail 'ambiguous publication did not retain its pending commit marker'
find "$ambiguous_backup_dir/cipher" -type f | grep -q . || \
  fail 'ambiguous publication did not retain local ciphertext'
assert_eq "$(jq -r '.artifactBytes > 0' \
  "$ambiguous_crash_case/state/monthly.last-size.json")" true

basebackup_count_before_reconcile=$(grep -c '^pg_basebackup$' \
  "$ambiguous_crash_case/operations.log")
run_scheduled_monthly "$ambiguous_crash_case" \
  FAKE_BACKUP_TIMESTAMP=20260715T120100Z
[ ! -e "$ambiguous_backup_dir" ] || \
  fail 'next monthly run did not reconcile the ambiguous publication'
if find "$ambiguous_crash_case/stage" -mindepth 1 -print | grep -q .; then
  fail 'reconciled monthly run retained local staging data'
fi
assert_eq "$(jq -r '.backupId' \
  "$ambiguous_crash_case/state/monthly.last-size.json")" \
  '20260715T120000Z-7555555555555555555'
assert_eq "$(grep -c '^pg_basebackup$' \
  "$ambiguous_crash_case/operations.log")" "$basebackup_count_before_reconcile"

locked_backup="$crash_case/stage/20260715T130000Z-7555555555555555555"
mkdir -p "$locked_backup/plain"
printf 'locked\n' >"$locked_backup/plain/sentinel"
lock_ready="$crash_case/lock-ready"
lock_release="$crash_case/lock-release"
(
  exec 8>"$crash_case/state/backup-job.lock"
  flock -x 8
  touch "$lock_ready"
  while [ ! -e "$lock_release" ]; do /bin/sleep 0.02; done
) &
lock_holder=$!
while [ ! -e "$lock_ready" ]; do /bin/sleep 0.02; done
set +e
POSTGRES_BACKUP_STAGE_DIR="$crash_case/stage" \
POSTGRES_BACKUP_STATE_DIR="$crash_case/state" \
  "$cleanup_script" >/dev/null 2>&1
locked_cleanup_status=$?
set -e
assert_eq "$locked_cleanup_status" 75
[ -f "$locked_backup/plain/sentinel" ] || \
  fail 'cleanup modified plaintext without owning the global job lock'
touch "$lock_release"
wait "$lock_holder"

set +e
(
  exec 9>"$crash_case/state/not-the-backup-job.lock"
  POSTGRES_BACKUP_STAGE_DIR="$crash_case/stage" \
  POSTGRES_BACKUP_STATE_DIR="$crash_case/state" \
    "$cleanup_script" --lock-held-fd 9 >/dev/null 2>&1
)
wrong_lock_status=$?
set -e
assert_eq "$wrong_lock_status" 64
printf 'ok - automatic cleanup removes crash orphans under the global lock\n'

untrusted_kms_case="$tmp/untrusted-kms"
make_fakes "$untrusted_kms_case"
if run_monthly "$untrusted_kms_case" \
  FAKE_KMS_KEY_ARN=arn:aws:kms:ap-southeast-1:111122223333:key/99999999-8888-7777-6666-555555555555; then
  fail 'monthly backup accepted a GenerateMac key outside the recovery key ring'
fi
if find "$untrusted_kms_case/remote/monthly" -name _SUCCESS.json -type f | \
  grep -q .; then
  fail 'untrusted GenerateMac key published a monthly success marker'
fi
grep -Fq monthly_authentication_failed "$untrusted_kms_case/stderr" || \
  fail 'untrusted GenerateMac key did not publish an authentication failure'
printf 'ok - monthly backup rejects KMS keys outside the trusted recovery ring\n'

recipient_case="$tmp/recipient"
make_fakes "$recipient_case"
if run_monthly "$recipient_case" POSTGRES_ARCHIVE_AGE_RECIPIENT=not-an-age-recipient; then
  fail 'invalid age recipient must fail closed'
fi
[ ! -e "$recipient_case/operations.log" ] || \
  ! grep -Fq pg_basebackup "$recipient_case/operations.log" || \
  fail 'invalid age recipient ran pg_basebackup'
printf 'ok - monthly archive inputs fail closed\n'

identifier_case="$tmp/identifier"
make_fakes "$identifier_case"
if run_monthly "$identifier_case" POSTGRES_REPLICATION_ROLE=$'postgres_backup\ninjected'; then
  fail 'invalid replication role must fail before writing pgpass'
fi
[ ! -e "$identifier_case/run/monthly.pgpass" ] || \
  fail 'invalid replication role wrote a pgpass file'
printf 'ok - monthly PostgreSQL identifiers reject config injection\n'
