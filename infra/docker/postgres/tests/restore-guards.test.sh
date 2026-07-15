#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

pitr="$ROOT/infra/docker/postgres/scripts/restore-pitr.sh"
monthly="$ROOT/infra/docker/postgres/scripts/restore-monthly.sh"
verify="$ROOT/infra/docker/postgres/scripts/restore-verify.sh"
restore_lib="$ROOT/infra/docker/postgres/scripts/restore-lib.sh"
old_kms_key_arn='arn:aws:kms:ap-southeast-1:111122223333:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
new_kms_key_arn='arn:aws:kms:ap-southeast-1:111122223333:key/ffffffff-1111-2222-3333-444444444444'

for script in "$pitr" "$monthly" "$verify"; do
  [ -x "$script" ] || fail "required restore script is missing: $script"
  if grep -Eq 'docker( compose)?|/var/run/docker\.sock' "$script"; then
    fail "restore script must not control the Docker daemon: $script"
  fi
done
grep -Fq 'POSTGRES_RESTORE_ROOT:-/var/lib/postgres-backup/restores' \
  "$restore_lib" || fail 'restore scripts default outside the dedicated restore volume'

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/restores" "$tmp/non-empty" "$tmp/source"
printf 'occupied\n' >"$tmp/non-empty/sentinel"
: >"$tmp/external-calls"

cat >"$tmp/bin/pgbackrest" <<'EOF'
#!/usr/bin/env sh
printf 'pgbackrest:%s\n' "$*" >>"$EXTERNAL_CALLS"
case " $* " in
  *' info '*)
    printf '[{"db":[{"id":1,"repo-key":1,"system-id":7555555555555555555,"version":"18"},{"id":2,"repo-key":1,"system-id":7666666666666666666,"version":"19"}],"backup":[{"label":"20260715-120000F","database":{"id":1,"repo-key":1},"timestamp":{"start":1784116800,"stop":1784116860},"info":{"size":1000,"delta":1000,"repository":{"size":500,"delta":500}}}]}]\n'
    exit 0
    ;;
esac
target=''
for argument in "$@"; do
  case "$argument" in --pg1-path=*) target=${argument#--pg1-path=} ;; esac
done
[ "${PGBACKREST_RESTORE_MODE:-success}" != fail ] || exit 74
[ -z "$target" ] || printf 'restored\n' >"$target/PG_VERSION"
EOF

cat >"$tmp/bin/rclone" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
printf 'rclone:%s\n' "$*" >>"$EXTERNAL_CALLS"
[ -n "${FAKE_REMOTE_ROOT:-}" ] || exit 99
[ "$1" = --config ] || exit 64
shift 2
command=$1
shift
case "$command" in
  lsf)
    find "$FAKE_REMOTE_ROOT/monthly" -name _LATEST.json -type f -print | \
      sed "s#^$FAKE_REMOTE_ROOT/monthly/##" | sort
    ;;
  cat)
    source=$1
    relative=${source#r2:*/monthly/}
    cat "$FAKE_REMOTE_ROOT/monthly/$relative"
    ;;
  copy)
    source=$1
    destination=$2
    relative=${source#r2:*/monthly/}
    cp -R "$FAKE_REMOTE_ROOT/monthly/$relative"/. "$destination"/
    ;;
  *) exit 64 ;;
esac
EOF

cat >"$tmp/bin/restore-verify" <<'EOF'
#!/usr/bin/env sh
printf 'verify:%s\n' "$*" >>"$EXTERNAL_CALLS"
jq -n '{status:"success"}' >"$RESTORE_VERIFY_RESULT_PATH"
EOF

cat >"$tmp/bin/pg_controldata" <<'EOF'
#!/usr/bin/env sh
printf 'Database system identifier:           7555555555555555555\n'
EOF

cat >"$tmp/bin/pg_ctl" <<'EOF'
#!/usr/bin/env sh
printf 'pg_ctl:%s\n' "$*" >>"$EXTERNAL_CALLS"
EOF

cat >"$tmp/bin/pg_isready" <<'EOF'
#!/usr/bin/env sh
printf 'pg_isready:%s\n' "$*" >>"$EXTERNAL_CALLS"
EOF

cat >"$tmp/bin/psql" <<'EOF'
#!/usr/bin/env sh
query=''
printf 'psql-args:%s\n' "$*" >>"$EXTERNAL_CALLS"
while [ "$#" -gt 0 ]; do
  [ "$1" != --command ] || { query=$2; break; }
  shift
done
printf 'psql:%s\n' "$query" >>"$EXTERNAL_CALLS"
case "$query" in
  'SHOW server_version_num') printf '180004\n' ;;
  'SHOW data_checksums') printf 'on\n' ;;
  *pg_control_system*) printf '7555555555555555555\n' ;;
  *'SELECT EXISTS'*) printf 't\n' ;;
  *to_regclass*) printf 't\n' ;;
  'SELECT 1') printf '1\n' ;;
  *) exit 65 ;;
esac
EOF

cat >"$tmp/bin/timeout" <<'EOF'
#!/usr/bin/env sh
while [ "$#" -gt 0 ]; do
  case "$1" in
    --foreground | --signal=* | --kill-after=*) shift ;;
    *) shift; break ;;
  esac
done
[ -z "${EXTERNAL_CALLS:-}" ] || printf 'timeout-call:%s\n' "$*" >>"$EXTERNAL_CALLS"
[ "${TIMEOUT_MODE:-run}" != expire ] || exit 124
[ -z "${TIMEOUT_MATCH:-}" ] || [ "$(basename -- "$1")" != "$TIMEOUT_MATCH" ] || exit 124
exec "$@"
EOF

cat >"$tmp/bin/age" <<'EOF'
#!/usr/bin/env sh
output=''
input=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --decrypt) ;;
    --identity) shift ;;
    --output) output=$2; shift ;;
    *) input=$1 ;;
  esac
  shift
done
cp "$input" "$output"
EOF

cat >"$tmp/bin/aws" <<'EOF'
#!/usr/bin/env sh
printf 'aws:%s\n' "$*" >>"$EXTERNAL_CALLS"
case " $* " in
  *' kms verify-mac '*)
    message=''
    while [ "$#" -gt 0 ]; do
      [ "$1" != --message ] || { message=${2#fileb://}; break; }
      shift
    done
    if [ "${AWS_KMS_VERIFY_MODE:-valid}" = invalid ]; then
      printf 'False\n'
    elif [ "${AWS_KMS_VERIFY_MODE:-valid}" = reject-newer ] && \
      grep -Fq 20260715T123000Z "$message"; then
      printf 'False\n'
    else
      printf 'True\n'
    fi
    ;;
  *' secretsmanager get-secret-value '*)
    printf 'AGE-SECRET-KEY-1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n'
    ;;
  *) exit 64 ;;
esac
EOF

cat >"$tmp/bin/zstd" <<'EOF'
#!/usr/bin/env sh
eval "input=\${$#}"
cat "$input"
EOF

cat >"$tmp/bin/df" <<'EOF'
#!/usr/bin/env sh
printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n'
printf 'restore 999999 1 %s 1%% /restore\n' "${RESTORE_AVAILABLE_KIB:-99999999}"
EOF

cat >"$tmp/bin/date-pitr" <<'EOF'
#!/usr/bin/env sh
case "$*" in
  '--date=2026-07-15T12:30:45Z +%s') printf '1784118645\n' ;;
  '--date=2026-07-15T12:00:30Z +%s') printf '1784116830\n' ;;
  '+%s') printf '1784131200\n' ;;
  *) exec /bin/date "$@" ;;
esac
EOF

cat >"$tmp/bin/tar-identity-check" <<'EOF'
#!/usr/bin/env sh
if find "$POSTGRES_BACKUP_RUNTIME_DIR" -maxdepth 1 -type f \
  -name 'monthly-age-identity.*' | grep -q .; then
  exit 88
fi
exec "$REAL_TAR_BIN" "$@"
EOF

cat >"$tmp/bin/tar-adversarial" <<'EOF'
#!/usr/bin/env sh
case " $* " in
  *' -tf - '*)
    if [ "${TAR_LIST_MODE:-fifo}" = traversal ]; then
      printf '../escape\n'
    else
      printf './safe\n'
    fi
    ;;
  *' -tvf - '*)
    case "${TAR_LIST_MODE:-fifo}" in
      fifo) printf 'prw------- postgres/postgres 0 2026-07-15 12:00 ./pipe\n' ;;
      hardlink) printf 'hrw------- postgres/postgres 0 2026-07-15 12:00 ./hard link to ./safe\n' ;;
      symlink) printf 'lrwxrwxrwx postgres/postgres 0 2026-07-15 12:00 ./escape -> ../outside\n' ;;
      traversal) printf '%s\n' '-rw------- postgres/postgres 1 2026-07-15 12:00 ../escape' ;;
    esac
    ;;
  *) exit 64 ;;
esac
EOF
chmod +x "$tmp/bin/"*

common_env=(
  PATH="$tmp/bin:$PATH"
  EXTERNAL_CALLS="$tmp/external-calls"
  POSTGRES_RESTORE_ROOT="$tmp/restores"
  POSTGRES_SOURCE_DATA_DIR="$tmp/source"
  RESTORE_VERIFY_BIN="$tmp/bin/restore-verify"
  RESTORE_TIMEOUT_SECONDS=60
  RESTORE_DF_BIN="$tmp/bin/df"
  POSTGRES_RESTORE_MIN_FREE_BYTES=1024
)

assert_guarded_failure() {
  local script=$1
  shift
  : >"$tmp/external-calls"
  if env "${common_env[@]}" "$script" "$@" >/dev/null 2>&1; then
    fail "unsafe restore invocation unexpectedly succeeded: $*"
  fi
  [ ! -s "$tmp/external-calls" ] || \
    fail "unsafe restore invocation reached an external adapter: $*"
}

assert_guarded_failure "$pitr" \
  --target-dir /var/lib/postgresql/18/docker --latest
assert_guarded_failure "$pitr" --target-dir "$tmp/non-empty" --latest
assert_guarded_failure "$pitr" \
  --target-dir "$tmp/restores/invalid-time" --target-time not-a-time
assert_guarded_failure "$monthly" --target-dir /var/lib/postgresql --latest

ln -s "$tmp/non-empty" "$tmp/restores/escape"
assert_guarded_failure "$pitr" --target-dir "$tmp/restores/escape" --latest
printf 'ok - destructive restore targets fail before external calls\n'

safe_target="$tmp/restores/pitr-safe"
env "${common_env[@]}" RESTORE_VERIFY_RESULT_PATH="$safe_target/restore-result.json" \
  "$pitr" --target-dir "$safe_target" --latest >/dev/null
safe_target=$(realpath "$safe_target")
[ -f "$safe_target/restore-result.json" ] || \
  fail 'safe PITR restore did not invoke verification'
assert_file_mode "$safe_target" 700
assert_file_contains "$tmp/external-calls" \
  "--tablespace-map-all=$safe_target.tablespaces"
[ -d "$safe_target.tablespaces" ] || \
  fail 'PITR restore did not create its isolated sibling tablespace root'
assert_file_contains "$tmp/external-calls" \
  '--expected-system-identifier 7555555555555555555'
assert_file_contains "$tmp/external-calls" '--set=20260715-120000F'
if grep -Fq -- '--delta' "$tmp/external-calls"; then
  fail 'PITR restore used unsafe delta mode'
fi
printf 'ok - PITR restore accepts only an isolated fresh target\n'

pitr_capacity_target="$tmp/restores/pitr-capacity"
: >"$tmp/external-calls"
set +e
env "${common_env[@]}" RESTORE_AVAILABLE_KIB=1 \
  "$pitr" --target-dir "$pitr_capacity_target" --latest >/dev/null 2>&1
pitr_capacity_status=$?
set -e
[ "$pitr_capacity_status" -ne 0 ] || fail 'PITR restore ignored capacity preflight'
if grep -Eq '^pgbackrest:.* restore$' "$tmp/external-calls"; then
  fail 'PITR capacity failure invoked pgBackRest restore'
fi
assert_eq "$(jq -r '.errorCategory' \
  "$pitr_capacity_target/restore-result.json")" restore_capacity_failed
printf 'ok - PITR restore checks isolated target capacity before restore\n'

mkdir -p "$tmp/state"
env "${common_env[@]}" POSTGRES_BACKUP_STATE_DIR="$tmp/state" \
  "$pitr" --latest --drill >/dev/null
assert_eq "$(jq -r '.status' "$tmp/state/pitr-drill.last-result.json")" success
if find "$tmp/restores" -maxdepth 1 -name 'pitr-drill-*' -type d | grep -q .; then
  fail 'successful PITR drill retained its temporary restore directory'
fi
printf 'ok - scheduled PITR drill publishes durable evidence and cleans target\n'

mkdir -p "$tmp/state-failure"
set +e
env "${common_env[@]}" POSTGRES_BACKUP_STATE_DIR="$tmp/state-failure" \
  PGBACKREST_RESTORE_MODE=fail "$pitr" --latest --drill >/dev/null 2>&1
pitr_drill_failure_status=$?
set -e
[ "$pitr_drill_failure_status" -ne 0 ] || fail 'failed PITR drill succeeded'
assert_eq "$(jq -r '.status' \
  "$tmp/state-failure/pitr-drill.last-result.json")" failure
if find "$tmp/restores" -maxdepth 1 -name 'pitr-drill-*' -type d | grep -q .; then
  fail 'failed PITR drill retained its temporary restore directory'
fi
printf 'ok - failed PITR drill publishes evidence and cleans target\n'

pitr_time_target="$tmp/restores/pitr-time"
: >"$tmp/external-calls"
env "${common_env[@]}" \
  BACKUP_DATE_BIN="$tmp/bin/date-pitr" \
  RESTORE_VERIFY_RESULT_PATH="$pitr_time_target/restore-result.json" \
  "$pitr" --target-dir "$pitr_time_target" \
  --target-time 2026-07-15T12:30:45Z >/dev/null
assert_file_contains "$tmp/external-calls" \
  '--target=2026-07-15 12:30:45+00'
if grep -Fq -- '--target=2026-07-15T12:30:45Z' "$tmp/external-calls"; then
  fail 'PITR forwarded RFC3339 syntax that pgBackRest 2.58 rejects'
fi
printf 'ok - PITR normalizes validated RFC3339 for pinned pgBackRest\n'

pitr_during_backup_target="$tmp/restores/pitr-during-backup"
: >"$tmp/external-calls"
set +e
env "${common_env[@]}" BACKUP_DATE_BIN="$tmp/bin/date-pitr" \
  "$pitr" --target-dir "$pitr_during_backup_target" \
  --target-time 2026-07-15T12:00:30Z >/dev/null 2>&1
pitr_during_backup_status=$?
set -e
[ "$pitr_during_backup_status" -ne 0 ] || \
  fail 'PITR selected a backup that had not completed at the target time'
if grep -Eq '^pgbackrest:.* restore$' "$tmp/external-calls"; then
  fail 'PITR attempted restore from a backup newer than the recovery target'
fi
assert_eq "$(jq -r '.errorCategory' \
  "$pitr_during_backup_target/restore-result.json")" repository_metadata_failed
printf 'ok - PITR requires the selected backup to finish before target time\n'

future_target="$tmp/restores/future"
future_time=$(date -u -d '+1 hour' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || \
  date -u -v+1H '+%Y-%m-%dT%H:%M:%SZ')
assert_guarded_failure "$pitr" \
  --target-dir "$future_target" --target-time "$future_time"

if ! grep -Fq "archive_mode=off" "$verify" || \
  ! grep -Fq "listen_addresses=''" "$verify"; then
  fail 'restore verification does not isolate PostgreSQL from TCP and archiving'
fi
printf 'ok - restore time and isolated verifier contracts\n'

verify_target="$tmp/restores/verify-success"
mkdir -p "$verify_target" "$tmp/run"
printf '18\n' >"$verify_target/PG_VERSION"
if [ -r /proc/uptime ]; then
  test_started_monotonic=$(awk 'NR == 1 {print int($1)}' /proc/uptime)
else
  test_started_monotonic=$(date +%s)
fi
: >"$tmp/external-calls"
env "${common_env[@]}" POSTGRES_BACKUP_RUNTIME_DIR="$tmp/run" \
  POSTGRES_USER=trading_rpc_restore \
  "$verify" \
  --target-dir "$verify_target" \
  --backup-id pitr-latest \
  --target-time latest \
  --started-monotonic "$test_started_monotonic" \
  --expected-system-identifier 7555555555555555555 >/dev/null
assert_eq "$(jq -r '.status' "$verify_target/restore-result.json")" success
jq -e '.checks | .postgresReady and .dataChecksums and
  .drizzleMigrations and .marketSnapshots and .selectOne' \
  "$verify_target/restore-result.json" >/dev/null || \
  fail 'restore verification result omitted required checks'
assert_file_contains "$tmp/external-calls" "listen_addresses=''"
assert_file_contains "$tmp/external-calls" 'archive_mode=off'
assert_file_contains "$tmp/external-calls" '-m fast -w stop'
assert_file_contains "$tmp/external-calls" '--username trading_rpc_restore'

timeout_target="$tmp/restores/verify-timeout"
mkdir -p "$timeout_target"
printf '18\n' >"$timeout_target/PG_VERSION"
: >"$tmp/external-calls"
set +e
env "${common_env[@]}" POSTGRES_BACKUP_RUNTIME_DIR="$tmp/run" \
  TIMEOUT_MODE=expire "$verify" \
  --target-dir "$timeout_target" \
  --backup-id pitr-timeout \
  --target-time latest \
  --started-monotonic "$test_started_monotonic" \
  --expected-system-identifier 7555555555555555555 >/dev/null 2>&1
timeout_status=$?
set -e
assert_eq "$timeout_status" 124
assert_eq "$(jq -r '.errorCategory' "$timeout_target/restore-result.json")" \
  restore_timeout
assert_file_contains "$tmp/external-calls" '-m fast -w stop'
printf 'ok - isolated verification publishes success and timeout evidence\n'

monthly_remote="$tmp/remote/monthly/2026/07/20260715T120000Z-7555555555555555555"
mkdir -p "$monthly_remote" "$tmp/monthly-base" "$tmp/monthly-wal"
printf '18\n' >"$tmp/monthly-base/PG_VERSION"
mkdir -p "$tmp/monthly-base/global" "$tmp/monthly-base/pg_tblspc"
printf 'control\n' >"$tmp/monthly-base/global/pg_control"
printf 'wal\n' >"$tmp/monthly-wal/000000090000000000000001"
tar -cf "$tmp/base.tar.zst" -C "$tmp/monthly-base" .
tar -cf "$tmp/pg_wal.tar" -C "$tmp/monthly-wal" .
printf '{"PostgreSQL-Backup-Manifest-Version":2}\n' >"$tmp/backup_manifest"

artifact_json='[]'
for artifact in "$tmp/base.tar.zst" "$tmp/pg_wal.tar" "$tmp/backup_manifest"; do
  name=$(basename "$artifact")
  size=$(stat -c '%s' "$artifact" 2>/dev/null || stat -f '%z' "$artifact")
  hash=$(sha256sum "$artifact" | awk '{print $1}')
  artifact_json=$(jq -cn --argjson current "$artifact_json" \
    --arg name "$name" --argjson size "$size" --arg hash "$hash" \
    '$current + [{name:$name,sizeBytes:$size,sha256:$hash}]')
  cp "$artifact" "$monthly_remote/$name.age"
done
jq -n \
  --arg backupId 20260715T120000Z-7555555555555555555 \
  --arg systemIdentifier 7555555555555555555 \
  --arg serviceName trading-rpc-example \
  --arg environment production \
  --argjson artifacts "$artifact_json" \
  '{schemaVersion:1,backupId:$backupId,serviceName:$serviceName,
    environment:$environment,systemIdentifier:$systemIdentifier,
    postgresqlMajorVersion:18,expandedBytes:16384,artifacts:$artifacts}' \
  >"$tmp/recovery-manifest.json"
cp "$tmp/recovery-manifest.json" "$monthly_remote/recovery-manifest.json.age"

outer_json='[]'
for ciphertext in "$monthly_remote"/*.age; do
  name=$(basename "$ciphertext")
  size=$(stat -c '%s' "$ciphertext" 2>/dev/null || stat -f '%z' "$ciphertext")
  hash=$(sha256sum "$ciphertext" | awk '{print $1}')
  outer_json=$(jq -cn --argjson current "$outer_json" \
    --arg name "$name" --argjson size "$size" --arg hash "$hash" \
    '$current + [{name:$name,sizeBytes:$size,sha256:$hash}]')
done
jq -n --argjson artifacts "$outer_json" '{schemaVersion:1,artifacts:$artifacts}' \
  >"$monthly_remote/upload-manifest.json"
upload_hash=$(sha256sum "$monthly_remote/upload-manifest.json" | awk '{print $1}')
write_signed_marker() {
  local marker_dir=$1
  local marker_backup_id=$2
  local marker_published_at=$3
  local marker_key_id=${4:-$old_kms_key_arn}
  local marker_claim="$tmp/marker-claim.json"
  local marker_payload

  mkdir -p "$marker_dir"
  jq -cS -n \
    --arg backupId "$marker_backup_id" \
    --arg publishedAt "$marker_published_at" \
    --arg uploadManifestSha256 "$upload_hash" \
  '{artifactBytes:1024,artifactCount:4,backupId:$backupId,
      ciphertextBytes:2048,expandedBytes:16384,publishedAt:$publishedAt,
      uploadManifestSha256:$uploadManifestSha256}' >"$marker_claim"
  marker_payload=$(base64 <"$marker_claim" | tr -d '\n')
  jq -n \
    --arg backupId "$marker_backup_id" \
    --arg publishedAt "$marker_published_at" \
    --arg uploadManifestSha256 "$upload_hash" \
    --arg signedPayloadBase64 "$marker_payload" \
    --arg authenticationKeyId "$marker_key_id" \
    '{schemaVersion:2,backupId:$backupId,publishedAt:$publishedAt,
      uploadManifestSha256:$uploadManifestSha256,artifactCount:4,
      ciphertextBytes:2048,artifactBytes:1024,expandedBytes:16384,
      signedPayloadBase64:$signedPayloadBase64,
      authentication:{scheme:"aws-kms-hmac-sha256",
        keyId:$authenticationKeyId,macBase64:"ZmFrZS1tYWM="}}' \
    >"$marker_dir/_SUCCESS.json"
}
write_signed_marker "$monthly_remote" \
  20260715T120000Z-7555555555555555555 2026-07-15T12:00:00Z
cp "$monthly_remote/_SUCCESS.json" \
  "$tmp/remote/monthly/2026/07/_LATEST.json"
forged_remote="$tmp/remote/monthly/2026/07/20260715T123000Z-7555555555555555555"
write_signed_marker "$forged_remote" \
  20260715T123000Z-7555555555555555555 2026-07-15T12:30:00Z \
  "$new_kms_key_arn"
future_remote="$tmp/remote/monthly/2099/01/20990101T000000Z-7555555555555555555"
write_signed_marker "$future_remote" \
  20990101T000000Z-7555555555555555555 2099-01-01T00:00:00Z
mismatch_remote="$tmp/remote/monthly/2026/08/20260715T124500Z-7555555555555555555"
write_signed_marker "$mismatch_remote" \
  20260715T124500Z-7555555555555555555 2026-07-15T12:45:00Z
printf 'archive-key\n' >"$tmp/archive-key"
printf 'archive-secret\n' >"$tmp/archive-secret"

monthly_target="$tmp/restores/monthly-safe"
: >"$tmp/external-calls"
monthly_env=(
  "${common_env[@]}"
  FAKE_REMOTE_ROOT="$tmp/remote" \
  POSTGRES_BACKUP_RUNTIME_DIR="$tmp/run" \
  R2_ACCOUNT_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  R2_ARCHIVE_BUCKET=trading-rpc-postgres-archive \
  R2_ARCHIVE_ACCESS_KEY_ID_FILE="$tmp/archive-key" \
  R2_ARCHIVE_SECRET_ACCESS_KEY_FILE="$tmp/archive-secret" \
  POSTGRES_BACKUP_SERVICE_NAME=trading-rpc-example \
  POSTGRES_BACKUP_ENVIRONMENT=production \
  POSTGRES_BACKUP_RECOVERY_SECRET_ID=production/monthly-recovery-key \
  POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS="$old_kms_key_arn,$new_kms_key_arn" \
  AWS_REGION=ap-southeast-1
  AWS_KMS_VERIFY_MODE=reject-newer
)
env "${monthly_env[@]}" \
  "$monthly" --target-dir "$monthly_target" --latest >/dev/null
monthly_target=$(realpath "$monthly_target")
[ -f "$monthly_target/PG_VERSION" ] || fail 'monthly base tar was not restored'
[ -f "$monthly_target/pg_wal/000000090000000000000001" ] || \
  fail 'monthly streamed WAL tar was not restored into pg_wal'
[ -d "$monthly_target/pg_tblspc" ] || \
  fail 'monthly restore dropped PostgreSQL required empty pg_tblspc directory'
assert_file_mode "$monthly_target/pg_tblspc" 700
assert_eq "$(jq -r '.status' "$monthly_target/restore-result.json")" success
assert_file_contains "$tmp/external-calls" \
  'aws:secretsmanager get-secret-value --region ap-southeast-1'
assert_file_contains "$tmp/external-calls" \
  'aws:kms verify-mac --region ap-southeast-1'
assert_file_contains "$tmp/external-calls" "--key-id $old_kms_key_arn"
if grep -Eq '^rclone:.* lsf ' "$tmp/external-calls"; then
  fail 'latest monthly restore listed attacker-controlled recovery candidates'
fi
if find "$tmp/run" -name 'monthly-age-identity.*' -type f | grep -q .; then
  fail 'monthly restore retained the private age identity'
fi
printf 'ok - monthly restore validates decrypts extracts and removes identity\n'

monthly_exact_target="$tmp/restores/monthly-exact"
: >"$tmp/external-calls"
env "${monthly_env[@]}" \
  "$monthly" --target-dir "$monthly_exact_target" \
  --backup-id 20260715T120000Z-7555555555555555555 >/dev/null
if grep -Eq '^rclone:.* lsf ' "$tmp/external-calls"; then
  fail 'exact monthly restore listed attacker-controlled recovery candidates'
fi
assert_eq "$(jq -r '.status' \
  "$monthly_exact_target/restore-result.json")" success
printf 'ok - exact monthly restore direct-addresses its authenticated marker\n'

new_key_backup_id=20260714T120000Z-7555555555555555555
new_key_remote="$tmp/remote/monthly/2026/07/$new_key_backup_id"
write_signed_marker "$new_key_remote" "$new_key_backup_id" \
  2026-07-14T12:00:00Z "$new_kms_key_arn"
new_key_target="$tmp/restores/monthly-new-kms-key"
: >"$tmp/external-calls"
set +e
env "${monthly_env[@]}" RESTORE_AVAILABLE_KIB=1 \
  "$monthly" --target-dir "$new_key_target" \
  --backup-id "$new_key_backup_id" >/dev/null 2>&1
new_key_status=$?
set -e
[ "$new_key_status" -ne 0 ] || fail 'new-key capacity guard unexpectedly succeeded'
assert_eq "$(jq -r '.errorCategory' \
  "$new_key_target/restore-result.json")" restore_capacity_failed
assert_file_contains "$tmp/external-calls" "--key-id $new_kms_key_arn"
printf 'ok - monthly restore accepts old and new immutable KMS key ARNs\n'

monthly_capacity_target="$tmp/restores/monthly-capacity"
: >"$tmp/external-calls"
set +e
env "${monthly_env[@]}" RESTORE_AVAILABLE_KIB=10 \
  "$monthly" --target-dir "$monthly_capacity_target" --latest \
  >/dev/null 2>&1
monthly_capacity_status=$?
set -e
[ "$monthly_capacity_status" -ne 0 ] || \
  fail 'monthly restore ignored capacity preflight'
if grep -Eq '^rclone:.* copy ' "$tmp/external-calls"; then
  fail 'monthly capacity failure downloaded archive artifacts'
fi
assert_eq "$(jq -r '.errorCategory' \
  "$monthly_capacity_target/restore-result.json")" restore_capacity_failed
printf 'ok - monthly restore checks peak staging capacity before download\n'

identity_lifetime_target="$tmp/restores/monthly-identity-lifetime"
env "${monthly_env[@]}" TAR_BIN="$tmp/bin/tar-identity-check" \
  REAL_TAR_BIN="$(command -v tar)" \
  "$monthly" --target-dir "$identity_lifetime_target" --latest >/dev/null
assert_eq "$(jq -r '.status' \
  "$identity_lifetime_target/restore-result.json")" success
printf 'ok - monthly restore removes recovery identity before extraction\n'

mkdir -p "$tmp/monthly-state-failure"
set +e
env "${monthly_env[@]}" AWS_KMS_VERIFY_MODE=invalid \
  POSTGRES_BACKUP_STATE_DIR="$tmp/monthly-state-failure" \
  "$monthly" --latest --drill >/dev/null 2>&1
monthly_drill_failure_status=$?
set -e
[ "$monthly_drill_failure_status" -ne 0 ] || fail 'failed monthly drill succeeded'
assert_eq "$(jq -r '.status' \
  "$tmp/monthly-state-failure/monthly-drill.last-result.json")" failure
if find "$tmp/restores" -maxdepth 1 -name 'monthly-drill-*' -type d | grep -q .; then
  fail 'failed monthly drill retained its temporary restore directory'
fi
printf 'ok - failed monthly drill publishes evidence and cleans target\n'

for timed_command in sha256sum bash; do
  monthly_timeout_target="$tmp/restores/monthly-timeout-$timed_command"
  set +e
  env "${monthly_env[@]}" TIMEOUT_MATCH="$timed_command" \
    "$monthly" --target-dir "$monthly_timeout_target" --latest \
    >/dev/null 2>&1
  monthly_timeout_status=$?
  set -e
  assert_eq "$monthly_timeout_status" 124
  assert_eq "$(jq -r '.errorCategory' \
    "$monthly_timeout_target/restore-result.json")" restore_timeout
done
printf 'ok - monthly hashing and extraction obey the restore deadline\n'

for tar_mode in traversal symlink hardlink fifo; do
  malicious_target="$tmp/restores/monthly-malicious-$tar_mode"
  if env "${monthly_env[@]}" TAR_BIN="$tmp/bin/tar-adversarial" \
    TAR_LIST_MODE="$tar_mode" \
    "$monthly" --target-dir "$malicious_target" --latest \
    >/dev/null 2>&1; then
    fail "monthly restore accepted malicious tar member: $tar_mode"
  fi
  assert_eq "$(jq -r '.errorCategory' \
    "$malicious_target/restore-result.json")" monthly_extraction_failed
done
printf 'ok - monthly restore rejects traversal links and special tar members\n'
