#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

stage_root=${POSTGRES_BACKUP_STAGE_DIR:-/var/lib/postgres-backup/stage}
state_dir=${POSTGRES_BACKUP_STATE_DIR:-/var/lib/postgres-backup/state}
runtime_dir=${POSTGRES_BACKUP_RUNTIME_DIR:-/run/postgres-backup}
socket_dir=${POSTGRES_SOCKET_DIR:-/var/run/postgresql}
postgres_data_dir=${POSTGRES_DATA_DIR:-/var/lib/postgresql/18/docker}
postgres_port=${POSTGRES_PORT:-5432}
postgres_user=${POSTGRES_USER:-trading_rpc}
postgres_db=${POSTGRES_DB:-trading_rpc}
replication_role=${POSTGRES_REPLICATION_ROLE:-postgres_backup}
minimum_free_bytes=${POSTGRES_MONTHLY_MIN_FREE_BYTES:-10737418240}

pg_basebackup_bin=${PG_BASEBACKUP_BIN:-pg_basebackup}
psql_bin=${PSQL_BIN:-psql}
pg_controldata_bin=${PG_CONTROLDATA_BIN:-pg_controldata}
pgbackrest_bin=${PGBACKREST_BIN:-pgbackrest}
age_bin=${AGE_BIN:-age}
rclone_bin=${RCLONE_BIN:-rclone}
aws_bin=${AWS_BIN:-aws}
df_bin=${DF_BIN:-df}
date_bin=${BACKUP_DATE_BIN:-date}
sha256_bin=${SHA256SUM_BIN:-sha256sum}
stat_bin=${STAT_BIN:-stat}
after_published_marker_hook=${BACKUP_AFTER_MONTHLY_PUBLISHED_MARKER_HOOK:-true}
before_verified_marker_hook=${BACKUP_BEFORE_MONTHLY_VERIFIED_MARKER_HOOK:-true}
monthly_cleanup_bin=${BACKUP_MONTHLY_ORPHAN_CLEANUP_BIN:-$SCRIPT_DIR/cleanup-monthly-orphans.sh}

backup_dir=''
plain_dir=''
cipher_dir=''
rclone_config=''
rclone_config_temporary=''
pgpass_file=''
age_probe_file=''
r2_preflight_file=''
r2_preflight_readback=''
success_file=''
success_readback=''
pending_marker=''
published_marker=''
signed_claim_file=''
failure_category=validation_failed
error_category_file=${POSTGRES_BACKUP_ERROR_CATEGORY_FILE:-}
reconciled_pending_publication=false

cleanup() {
  local status=$?

  trap - EXIT
  if [ -n "$plain_dir" ]; then
    rm -rf -- "$plain_dir"
  fi
  rm -f -- "$rclone_config" "$rclone_config_temporary" "$pgpass_file" \
    "$age_probe_file" "$r2_preflight_file" "$r2_preflight_readback" \
    "$success_readback" "$signed_claim_file"
  if [ "$status" -ne 0 ]; then
    if [ -n "$error_category_file" ]; then
      install -d -m 0700 "$(dirname -- "$error_category_file")" || true
      atomic_write_json "$error_category_file" -n \
        --arg errorCategory "$failure_category" \
        '{errorCategory:$errorCategory}' >/dev/null 2>&1 || true
    fi
    json_log error monthly_backup_failed "$failure_category" >&2 || true
  fi
  exit "$status"
}
trap cleanup EXIT

require_safe_metadata() {
  local name=$1
  local value

  value=$(require_scalar_value "$name" "$2") || return 1
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || {
    printf '%s contains unsupported characters\n' "$name" >&2
    return 1
  }
  printf '%s' "$value"
}

require_positive_integer() {
  local name=$1
  local value=$2

  case "$value" in
    '' | *[!0-9]*)
      printf '%s must be a positive integer\n' "$name" >&2
      return 1
      ;;
  esac
  [ "$value" -gt 0 ] || {
    printf '%s must be a positive integer\n' "$name" >&2
    return 1
  }
  printf '%s' "$value"
}

require_postgres_identifier() {
  local name=$1
  local value

  value=$(require_scalar_value "$name" "$2") || return 1
  [[ "$value" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || {
    printf '%s must be an unquoted PostgreSQL identifier\n' "$name" >&2
    return 1
  }
  printf '%s' "$value"
}

require_kms_key_arn() {
  local name=$1
  local value=$2

  [[ "$value" =~ ^arn:aws(-[a-z]+)?:kms:[a-z0-9-]+:[0-9]{12}:key/[A-Za-z0-9-]{1,128}$ ]] || {
    printf '%s must be an immutable AWS KMS key ARN\n' "$name" >&2
    return 1
  }
  printf '%s' "$value"
}

kms_key_is_trusted() {
  local candidate=$1
  local trusted_key

  for trusted_key in "${trusted_kms_key_ids[@]}"; do
    [ "$candidate" != "$trusted_key" ] || return 0
  done
  return 1
}

file_size_bytes() {
  "$stat_bin" -c '%s' "$1" 2>/dev/null || "$stat_bin" -f '%z' "$1"
}

sha256_file() {
  "$sha256_bin" "$1" | awk '{print $1}'
}

write_rclone_config() {
  local access_key
  local secret_key

  access_key=$(require_scalar_file R2_ARCHIVE_ACCESS_KEY_ID \
    "${R2_ARCHIVE_ACCESS_KEY_ID_FILE:-}") || return 1
  secret_key=$(require_scalar_file R2_ARCHIVE_SECRET_ACCESS_KEY \
    "${R2_ARCHIVE_SECRET_ACCESS_KEY_FILE:-}") || return 1
  rclone_config_temporary=$(mktemp "$runtime_dir/rclone.conf.tmp.XXXXXX")
  chmod 0600 "$rclone_config_temporary"
  cat >"$rclone_config_temporary" <<EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = $access_key
secret_access_key = $secret_key
region = auto
endpoint = https://$r2_account_id.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
EOF
  mv -f -- "$rclone_config_temporary" "$rclone_config"
  rclone_config_temporary=''
  chmod 0600 "$rclone_config"
}

run_rclone() {
  "$rclone_bin" --config "$rclone_config" "$@"
}

retry_rclone() {
  retry_with_backoff run_rclone "$@"
}

reconcile_pending_publications() {
  local pending_path
  local candidate
  local backup_id
  local marker_metadata
  local artifact_bytes
  local published_at
  local expected_success_hash
  local pending_success
  local cipher_path
  local year
  local month
  local monthly_remote
  local latest_remote
  local verified_marker
  local lock_fd=${POSTGRES_BACKUP_LOCK_FD:-}

  shopt -s nullglob
  for pending_path in "$stage_root"/*/.remote-success-pending.json; do
    candidate=$(dirname -- "$pending_path")
    [ -d "$candidate" ] && [ ! -L "$candidate" ] || continue
    backup_id=$(basename -- "$candidate")
    [[ "$backup_id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]] || continue
    [ -f "$pending_path" ] && [ ! -L "$pending_path" ] || continue

    marker_metadata=$(jq -er --arg backupId "$backup_id" \
      'select((.schemaVersion == 1 or .schemaVersion == 2) and .backupId == $backupId) |
       select(.artifactBytes | type == "number" and floor == . and . > 0) |
       select(.publishedAt | type == "string") |
       [.artifactBytes, .publishedAt] | @tsv' \
      "$pending_path" 2>/dev/null) || {
      printf 'pending monthly publication marker is invalid\n' >&2
      return 65
    }
    IFS=$'\t' read -r artifact_bytes published_at \
      <<<"$marker_metadata"
    [[ "$published_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || {
      printf 'pending monthly publication metadata is invalid\n' >&2
      return 65
    }

    pending_success="$pending_path"
    cipher_path="$candidate/cipher"
    [ -f "$pending_success" ] && [ ! -L "$pending_success" ] && \
      [ -d "$cipher_path" ] && [ ! -L "$cipher_path" ] || {
      printf 'pending monthly publication artifacts are incomplete\n' >&2
      return 66
    }
    expected_success_hash=$(sha256_file "$pending_success")

    year=${backup_id:0:4}
    month=${backup_id:4:2}
    monthly_remote="r2:$r2_bucket/monthly/$year/$month/$backup_id"
    latest_remote="r2:$r2_bucket/monthly/$year/$month/_LATEST.json"
    if retry_rclone cat "$monthly_remote/_SUCCESS.json" \
      >"$success_readback" 2>/dev/null; then
      cmp -s -- "$pending_success" "$success_readback" || {
        printf 'remote monthly success document conflicts with pending state\n' >&2
        return 66
      }
    else
      retry_rclone check "$cipher_path" "$monthly_remote" --download >/dev/null
      retry_rclone copyto "$pending_success" "$monthly_remote/_SUCCESS.json" \
        --immutable >/dev/null
      retry_rclone cat "$monthly_remote/_SUCCESS.json" >"$success_readback"
      cmp -s -- "$pending_success" "$success_readback" || {
        printf 'reconciled monthly success document did not match\n' >&2
        return 66
      }
    fi
    if retry_rclone cat "$latest_remote" >"$success_readback" 2>/dev/null; then
      cmp -s -- "$pending_success" "$success_readback" || {
        printf 'remote monthly latest pointer conflicts with pending state\n' >&2
        return 66
      }
    else
      retry_rclone copyto "$pending_success" "$latest_remote" \
        --immutable >/dev/null
      retry_rclone cat "$latest_remote" >"$success_readback"
      cmp -s -- "$pending_success" "$success_readback" || {
        printf 'reconciled monthly latest pointer did not match\n' >&2
        return 66
      }
    fi

    [ "$lock_fd" = 9 ] || {
      printf 'pending publication reconciliation requires the backup-job lock\n' >&2
      return 75
    }
    verified_marker="$candidate/.remote-success-verified.json"
    atomic_write_json "$verified_marker" -n \
      --arg backupId "$backup_id" \
      --arg publishedAt "$published_at" \
      --arg remoteSuccessSha256 "$expected_success_hash" \
      --argjson artifactBytes "$artifact_bytes" \
      '{schemaVersion:1,backupId:$backupId,remoteSuccessVerified:true,
        artifactBytes:$artifactBytes,publishedAt:$publishedAt,
        remoteSuccessSha256:$remoteSuccessSha256}'
    "$monthly_cleanup_bin" --lock-held-fd "$lock_fd"
    reconciled_pending_publication=true
  done
}

failure_category=validation_failed
postgres_user=$(require_postgres_identifier POSTGRES_USER "$postgres_user")
postgres_db=$(require_postgres_identifier POSTGRES_DB "$postgres_db")
replication_role=$(require_postgres_identifier POSTGRES_REPLICATION_ROLE \
  "$replication_role")
postgres_port=$(require_positive_integer POSTGRES_PORT "$postgres_port")
[ "$postgres_port" -le 65535 ] || {
  printf 'POSTGRES_PORT must be at most 65535\n' >&2
  exit 64
}
service_name=$(require_safe_metadata POSTGRES_BACKUP_SERVICE_NAME \
  "${POSTGRES_BACKUP_SERVICE_NAME:-}")
backup_environment=$(require_safe_metadata POSTGRES_BACKUP_ENVIRONMENT \
  "${POSTGRES_BACKUP_ENVIRONMENT:-}")
r2_account_id=$(require_scalar_value R2_ACCOUNT_ID "${R2_ACCOUNT_ID:-}")
[[ "$r2_account_id" =~ ^[A-Fa-f0-9]{32}$ ]] || {
  printf 'R2_ACCOUNT_ID must be a 32-character hexadecimal account identifier\n' >&2
  exit 64
}
r2_bucket=$(require_scalar_value R2_ARCHIVE_BUCKET "${R2_ARCHIVE_BUCKET:-}")
[[ "$r2_bucket" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] && \
  [[ "$r2_bucket" != *..* ]] || {
  printf 'R2_ARCHIVE_BUCKET is not a valid private bucket name\n' >&2
  exit 64
}
age_recipient=$(require_scalar_value POSTGRES_ARCHIVE_AGE_RECIPIENT \
  "${POSTGRES_ARCHIVE_AGE_RECIPIENT:-}")
[[ "$age_recipient" =~ ^age1[0-9a-z]+$ ]] || {
  printf 'POSTGRES_ARCHIVE_AGE_RECIPIENT must be a native age recipient\n' >&2
  exit 64
}
kms_key_id=$(require_scalar_value POSTGRES_BACKUP_KMS_KEY_ID \
  "${POSTGRES_BACKUP_KMS_KEY_ID:-}")
[[ "$kms_key_id" =~ ^[A-Za-z0-9:/_.-]+$ ]] && \
  [ "${#kms_key_id}" -le 2048 ] || {
  printf 'POSTGRES_BACKUP_KMS_KEY_ID is invalid\n' >&2
  exit 64
}
trusted_kms_key_ids_value=$(require_scalar_value \
  POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS \
  "${POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS:-}")
IFS=',' read -r -a trusted_kms_key_ids <<<"$trusted_kms_key_ids_value"
[ "${#trusted_kms_key_ids[@]}" -gt 0 ] || exit 64
for trusted_kms_key_index in "${!trusted_kms_key_ids[@]}"; do
  trusted_kms_key_ids[$trusted_kms_key_index]=$(require_kms_key_arn \
    POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS \
    "${trusted_kms_key_ids[$trusted_kms_key_index]}") || exit 64
done
aws_region=$(require_scalar_value AWS_REGION "${AWS_REGION:-}")
[[ "$aws_region" =~ ^[a-z]{2}(-gov)?-[a-z0-9-]+-[0-9]+$ ]] || {
  printf 'AWS_REGION is invalid\n' >&2
  exit 64
}
minimum_free_bytes=$(require_positive_integer POSTGRES_MONTHLY_MIN_FREE_BYTES \
  "$minimum_free_bytes")

install -d -m 0700 "$stage_root" "$state_dir" "$runtime_dir"
umask 077
rclone_config="$runtime_dir/rclone.conf"
pgpass_file="$runtime_dir/monthly.pgpass"
age_probe_file="$runtime_dir/monthly-recipient-probe.age"
r2_preflight_file="$runtime_dir/monthly-r2-preflight.json"
r2_preflight_readback="$runtime_dir/monthly-r2-preflight.readback.json"
success_readback="$runtime_dir/monthly-success.readback.json"

failure_category=recipient_validation_failed
"$age_bin" --recipient "$age_recipient" --output "$age_probe_file" \
  /dev/null >/dev/null
rm -f -- "$age_probe_file"
age_probe_file=''

failure_category=rclone_config_failed
write_rclone_config
failure_category=r2_preflight_failed
retry_rclone lsf "r2:$r2_bucket" --max-depth 1 --dirs-only >/dev/null
r2_preflight_epoch=$($date_bin +%s)
[[ "$r2_preflight_epoch" =~ ^[0-9]+$ ]] || {
  printf 'R2 preflight timestamp is invalid\n' >&2
  exit 70
}
r2_preflight_remote="r2:$r2_bucket/staging/_preflight/$service_name-$backup_environment-$r2_preflight_epoch-$$"
atomic_write_json "$r2_preflight_file" -n \
  --arg serviceName "$service_name" \
  --arg environment "$backup_environment" \
  '{schemaVersion:1,serviceName:$serviceName,environment:$environment}'
retry_rclone copyto "$r2_preflight_file" \
  "$r2_preflight_remote/probe.json" --immutable >/dev/null
retry_rclone cat "$r2_preflight_remote/probe.json" >"$r2_preflight_readback"
cmp -s -- "$r2_preflight_file" "$r2_preflight_readback" || {
  printf 'R2 preflight readback did not match\n' >&2
  exit 70
}
retry_rclone deletefile "$r2_preflight_remote/probe.json" >/dev/null
retry_rclone rmdir "$r2_preflight_remote" >/dev/null
rm -f -- "$r2_preflight_file" "$r2_preflight_readback"
r2_preflight_file=''
r2_preflight_readback=''

failure_category=publication_reconciliation_failed
reconcile_pending_publications
if [ "$reconciled_pending_publication" = true ]; then
  json_log info monthly_backup_reconciled_existing_publication \
    'no duplicate monthly archive was created'
  exit 0
fi

failure_category=capacity_preflight_failed
previous_size_path="$state_dir/monthly.last-size.json"
required_free_bytes=$minimum_free_bytes
if [ -e "$previous_size_path" ]; then
  previous_artifact_bytes=$(jq -er \
    '.artifactBytes | select(type == "number" and floor == . and . > 0)' \
    "$previous_size_path") || {
    printf 'monthly backup size state is invalid\n' >&2
    exit 65
  }
  required_free_bytes=$(((previous_artifact_bytes * 3 + 1) / 2))
fi
available_kib=$(
  "$df_bin" -Pk "$stage_root" | awk 'NR == 2 {print $4}'
)
case "$available_kib" in
  '' | *[!0-9]*)
    printf 'unable to determine monthly backup staging capacity\n' >&2
    exit 74
    ;;
esac
available_bytes=$((available_kib * 1024))
[ "$available_bytes" -ge "$required_free_bytes" ] || {
  printf 'insufficient monthly backup staging capacity\n' >&2
  exit 75
}

failure_category=replication_auth_failed
replication_password=$(require_scalar_file POSTGRES_REPLICATION_PASSWORD \
  "${POSTGRES_REPLICATION_PASSWORD_FILE:-}")
escaped_replication_password=${replication_password//\\/\\\\}
escaped_replication_password=${escaped_replication_password//:/\\:}
printf '*:*:*:%s:%s\n' "$replication_role" "$escaped_replication_password" \
  >"$pgpass_file"
chmod 0600 "$pgpass_file"

failure_category=database_identity_failed
control_data=$(LC_ALL=C "$pg_controldata_bin" "$postgres_data_dir" 2>/dev/null)
system_identifier=$(printf '%s\n' "$control_data" | awk -F: \
  '/^Database system identifier:/ {gsub(/[[:space:]]/, "", $2); print $2}')
timeline_id=$(printf '%s\n' "$control_data" | awk -F: \
  "/^Latest checkpoint's TimeLineID:/ {gsub(/[[:space:]]/, \"\", \$2); print \$2}")
server_version_num=$(
  "$psql_bin" \
    --host "$socket_dir" --port "$postgres_port" \
    --username "$postgres_user" --dbname "$postgres_db" \
    --quiet --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "SELECT current_setting('server_version_num')" \
    2>/dev/null | tr -d '[:space:]'
)
[[ "$system_identifier" =~ ^[0-9]+$ ]] && [[ "$timeline_id" =~ ^[0-9]+$ ]] && \
  [[ "$server_version_num" =~ ^[0-9]+$ ]] || {
  printf 'PostgreSQL control identity is invalid\n' >&2
  exit 69
}

failure_category=backup_identity_failed
backup_timestamp=$($date_bin -u '+%Y%m%dT%H%M%SZ')
[[ "$backup_timestamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || {
  printf 'monthly backup timestamp is invalid\n' >&2
  exit 70
}
backup_id="$backup_timestamp-$system_identifier"
year=${backup_timestamp:0:4}
month=${backup_timestamp:4:2}
backup_dir="$stage_root/$backup_id"
plain_dir="$backup_dir/plain"
cipher_dir="$backup_dir/cipher"
[ ! -e "$backup_dir" ] || {
  printf 'monthly backup staging identifier already exists\n' >&2
  exit 73
}
failure_category=staging_setup_failed
install -d -m 0700 "$plain_dir" "$cipher_dir"

started_at=$($date_bin -u '+%Y-%m-%dT%H:%M:%SZ')
failure_category=basebackup_failed
PGPASSFILE="$pgpass_file" "$pg_basebackup_bin" \
  --host="$socket_dir" --port="$postgres_port" --username="$replication_role" \
  --checkpoint=fast --wal-method=stream --format=tar \
  --compress=zstd:level=3 --manifest-checksums=SHA256 \
  --pgdata="$plain_dir" >/dev/null
finished_at=$($date_bin -u '+%Y-%m-%dT%H:%M:%SZ')

failure_category=artifact_manifest_failed
backup_artifacts=()
while IFS= read -r -d '' artifact_path; do
  backup_artifacts+=("$artifact_path")
done < <(find "$plain_dir" -maxdepth 1 -type f -print0 | sort -z)
[ "${#backup_artifacts[@]}" -gt 0 ] || {
  printf 'pg_basebackup emitted no physical backup artifacts\n' >&2
  exit 70
}

artifact_json='[]'
artifact_bytes=0
for artifact_path in "${backup_artifacts[@]}"; do
  artifact_name=$(basename -- "$artifact_path")
  [[ "$artifact_name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$ ]] || {
    printf 'pg_basebackup emitted an unsafe artifact name\n' >&2
    exit 70
  }
  artifact_size=$(file_size_bytes "$artifact_path")
  artifact_hash=$(sha256_file "$artifact_path")
  artifact_bytes=$((artifact_bytes + artifact_size))
  artifact_json=$(jq -cn \
    --argjson current "$artifact_json" \
    --arg name "$artifact_name" \
    --arg sha256 "$artifact_hash" \
    --argjson sizeBytes "$artifact_size" \
    '$current + [{name:$name,sizeBytes:$sizeBytes,sha256:$sha256}]')
done
expanded_bytes=$(jq -er '
  select(."PostgreSQL-Backup-Manifest-Version" == 2) |
  [.Files[]?.Size | select(type == "number" and floor == . and . >= 0)] |
  add | select(. > 0)
' "$plain_dir/backup_manifest") || {
  printf 'PostgreSQL backup manifest has no valid expanded size\n' >&2
  exit 70
}

postgres_major_version=$((server_version_num / 10000))
pg_basebackup_version=$($pg_basebackup_bin --version | head -n 1)
pgbackrest_version=$($pgbackrest_bin version | head -n 1)
recovery_manifest="$plain_dir/recovery-manifest.json"
atomic_write_json "$recovery_manifest" -n \
  --arg backupId "$backup_id" \
  --arg serviceName "$service_name" \
  --arg environment "$backup_environment" \
  --arg systemIdentifier "$system_identifier" \
  --argjson timeline "$timeline_id" \
  --argjson postgresqlMajorVersion "$postgres_major_version" \
  --argjson expandedBytes "$expanded_bytes" \
  --arg startedAt "$started_at" \
  --arg finishedAt "$finished_at" \
  --arg pgBasebackupVersion "$pg_basebackup_version" \
  --arg pgBackRestVersion "$pgbackrest_version" \
  --argjson artifacts "$artifact_json" \
  '{schemaVersion:1,backupId:$backupId,serviceName:$serviceName,
    environment:$environment,systemIdentifier:$systemIdentifier,
    timeline:$timeline,postgresqlMajorVersion:$postgresqlMajorVersion,
    expandedBytes:$expandedBytes,
    startedAt:$startedAt,finishedAt:$finishedAt,
    pgBasebackupVersion:$pgBasebackupVersion,
    pgBackRestVersion:$pgBackRestVersion,artifacts:$artifacts}'

failure_category=encryption_failed
plaintext_files=()
while IFS= read -r -d '' plaintext_path; do
  plaintext_files+=("$plaintext_path")
done < <(find "$plain_dir" -maxdepth 1 -type f -print0 | sort -z)
for plaintext_path in "${plaintext_files[@]}"; do
  plaintext_name=$(basename -- "$plaintext_path")
  ciphertext_path="$cipher_dir/$plaintext_name.age"
  "$age_bin" --recipient "$age_recipient" \
    --output "$ciphertext_path" "$plaintext_path" >/dev/null
  chmod 0600 "$ciphertext_path"
  rm -f -- "$plaintext_path"
done
rmdir -- "$plain_dir"
plain_dir=''

ciphertext_json='[]'
ciphertext_bytes=0
ciphertext_files=()
while IFS= read -r -d '' ciphertext_path; do
  ciphertext_files+=("$ciphertext_path")
done < <(find "$cipher_dir" -maxdepth 1 -type f -name '*.age' -print0 | sort -z)
for ciphertext_path in "${ciphertext_files[@]}"; do
  ciphertext_name=$(basename -- "$ciphertext_path")
  ciphertext_size=$(file_size_bytes "$ciphertext_path")
  ciphertext_hash=$(sha256_file "$ciphertext_path")
  ciphertext_bytes=$((ciphertext_bytes + ciphertext_size))
  ciphertext_json=$(jq -cn \
    --argjson current "$ciphertext_json" \
    --arg name "$ciphertext_name" \
    --arg sha256 "$ciphertext_hash" \
    --argjson sizeBytes "$ciphertext_size" \
    '$current + [{name:$name,sizeBytes:$sizeBytes,sha256:$sha256}]')
done
[ "${#ciphertext_files[@]}" -eq "${#plaintext_files[@]}" ] || {
  printf 'monthly backup encryption artifact count mismatch\n' >&2
  exit 70
}

failure_category=upload_manifest_failed
upload_manifest="$cipher_dir/upload-manifest.json"
atomic_write_json "$upload_manifest" -n \
  --arg backupId "$backup_id" \
  --argjson artifacts "$ciphertext_json" \
  '{schemaVersion:1,backupId:$backupId,artifacts:$artifacts}'
upload_files=()
while IFS= read -r -d '' upload_path; do
  upload_files+=("$upload_path")
done < <(find "$cipher_dir" -maxdepth 1 -type f -print0 | sort -z)

staging_remote="r2:$r2_bucket/staging/$backup_id"
monthly_remote="r2:$r2_bucket/monthly/$year/$month/$backup_id"

failure_category=staging_upload_failed
retry_rclone copy "$cipher_dir" "$staging_remote" --immutable >/dev/null
failure_category=staging_verification_failed
retry_rclone check "$cipher_dir" "$staging_remote" --download >/dev/null

failure_category=monthly_publish_failed
for upload_path in "${upload_files[@]}"; do
  upload_name=$(basename -- "$upload_path")
  retry_rclone copyto "$staging_remote/$upload_name" \
    "$monthly_remote/$upload_name" --immutable >/dev/null
done
failure_category=monthly_verification_failed
retry_rclone check "$cipher_dir" "$monthly_remote" --download >/dev/null

published_at=$($date_bin -u '+%Y-%m-%dT%H:%M:%SZ')
upload_manifest_hash=$(sha256_file "$upload_manifest")
pending_marker="$backup_dir/.remote-success-pending.json"
success_file="$pending_marker"
signed_claim_file=$(mktemp "$runtime_dir/monthly-publication-claim.XXXXXX")
jq -cS -n \
  --arg backupId "$backup_id" \
  --arg publishedAt "$published_at" \
  --arg uploadManifestSha256 "$upload_manifest_hash" \
  --argjson artifactCount "${#ciphertext_files[@]}" \
  --argjson ciphertextBytes "$ciphertext_bytes" \
  --argjson artifactBytes "$artifact_bytes" \
  --argjson expandedBytes "$expanded_bytes" \
  '{artifactBytes:$artifactBytes,artifactCount:$artifactCount,backupId:$backupId,
    ciphertextBytes:$ciphertextBytes,expandedBytes:$expandedBytes,
    publishedAt:$publishedAt,
    uploadManifestSha256:$uploadManifestSha256}' >"$signed_claim_file"
chmod 0600 "$signed_claim_file"
failure_category=monthly_authentication_failed
publication_mac_response=$("$aws_bin" kms generate-mac \
  --region "$aws_region" --key-id "$kms_key_id" \
  --mac-algorithm HMAC_SHA_256 \
  --message "fileb://$signed_claim_file" --output json)
publication_key_id=$(jq -er \
  '.KeyId | strings' <<<"$publication_mac_response")
publication_key_id=$(require_kms_key_arn 'KMS GenerateMac KeyId' \
  "$publication_key_id") || exit 70
kms_key_is_trusted "$publication_key_id" || {
  printf 'KMS GenerateMac used a key outside the trusted recovery key ring\n' >&2
  exit 70
}
publication_mac=$(jq -er \
  'select(.MacAlgorithm == "HMAC_SHA_256") | .Mac | strings' \
  <<<"$publication_mac_response")
[[ "$publication_mac" =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || {
  printf 'KMS returned an invalid monthly publication MAC\n' >&2
  exit 70
}
signed_payload_base64=$(base64 <"$signed_claim_file" | tr -d '\n')
atomic_write_json "$success_file" -n \
  --arg backupId "$backup_id" \
  --arg publishedAt "$published_at" \
  --arg uploadManifestSha256 "$upload_manifest_hash" \
  --arg signedPayloadBase64 "$signed_payload_base64" \
  --arg authenticationKeyId "$publication_key_id" \
  --arg authenticationMac "$publication_mac" \
  --argjson artifactCount "${#ciphertext_files[@]}" \
  --argjson ciphertextBytes "$ciphertext_bytes" \
  --argjson artifactBytes "$artifact_bytes" \
  --argjson expandedBytes "$expanded_bytes" \
  '{schemaVersion:2,backupId:$backupId,publishedAt:$publishedAt,
    uploadManifestSha256:$uploadManifestSha256,
    artifactCount:$artifactCount,ciphertextBytes:$ciphertextBytes,
    artifactBytes:$artifactBytes,expandedBytes:$expandedBytes,
    signedPayloadBase64:$signedPayloadBase64,
    authentication:{scheme:"aws-kms-hmac-sha256",keyId:$authenticationKeyId,
      macBase64:$authenticationMac}}'
rm -f -- "$signed_claim_file"
signed_claim_file=''
success_file_hash=$(sha256_file "$success_file")

failure_category=success_marker_failed
retry_rclone copyto "$success_file" "$monthly_remote/_SUCCESS.json" \
  --immutable >/dev/null
retry_rclone cat "$monthly_remote/_SUCCESS.json" >"$success_readback"
cmp -s -- "$success_file" "$success_readback" || {
  printf 'published monthly success marker verification failed\n' >&2
  exit 70
}
latest_remote="r2:$r2_bucket/monthly/$year/$month/_LATEST.json"
retry_rclone copyto "$success_file" "$latest_remote" \
  --immutable >/dev/null
retry_rclone cat "$latest_remote" >"$success_readback"
cmp -s -- "$success_file" "$success_readback" || {
  printf 'published monthly latest pointer verification failed\n' >&2
  exit 70
}
"$before_verified_marker_hook"

failure_category=published_marker_failed
published_marker="$backup_dir/.remote-success-verified.json"
atomic_write_json "$published_marker" -n \
  --arg backupId "$backup_id" \
  --arg publishedAt "$published_at" \
  --arg remoteSuccessSha256 "$success_file_hash" \
  --argjson artifactBytes "$artifact_bytes" \
  '{schemaVersion:1,backupId:$backupId,remoteSuccessVerified:true,
    artifactBytes:$artifactBytes,publishedAt:$publishedAt,
    remoteSuccessSha256:$remoteSuccessSha256}'
"$after_published_marker_hook"

failure_category=staging_cleanup_failed
for upload_path in "${upload_files[@]}"; do
  upload_name=$(basename -- "$upload_path")
  retry_rclone deletefile "$staging_remote/$upload_name" >/dev/null
done
retry_rclone rmdir "$staging_remote" >/dev/null

failure_category=state_publish_failed
atomic_write_json "$state_dir/monthly.last-size.json" -n \
  --arg backupId "$backup_id" \
  --argjson artifactBytes "$artifact_bytes" \
  --arg recordedAt "$published_at" \
  '{backupId:$backupId,artifactBytes:$artifactBytes,recordedAt:$recordedAt}'

rm -rf -- "$backup_dir"
backup_dir=''
json_log info monthly_backup_published "$backup_id"
