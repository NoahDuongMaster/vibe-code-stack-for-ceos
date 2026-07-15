#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/restore-lib.sh"

rclone_bin=${RCLONE_BIN:-rclone}
age_bin=${AGE_BIN:-age}
aws_bin=${AWS_BIN:-aws}
sha256_bin=${SHA256SUM_BIN:-sha256sum}
stat_bin=${STAT_BIN:-stat}
zstd_bin=${ZSTD_BIN:-zstd}
tar_bin=${TAR_BIN:-tar}
verify_bin=${RESTORE_VERIFY_BIN:-$SCRIPT_DIR/restore-verify.sh}
runtime_dir=${POSTGRES_BACKUP_RUNTIME_DIR:-/run/postgres-backup}
target_dir=''
requested_backup_id=''
restore_latest=false
drill_mode=false
work_dir=''
artifact_dir=''
identity_file=''
rclone_config=''
recovery_manifest=''
authenticated_success_file=''
signed_claim_file=''
failure_category=restore_validation_failed

usage() {
  printf 'usage: restore-monthly.sh --target-dir PATH (--latest | --backup-id ID)\n' >&2
  exit 64
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

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-dir) [ "$#" -ge 2 ] || usage; target_dir=$2; shift 2 ;;
    --latest) restore_latest=true; shift ;;
    --backup-id) [ "$#" -ge 2 ] || usage; requested_backup_id=$2; shift 2 ;;
    --drill) drill_mode=true; shift ;;
    *) usage ;;
  esac
done
if [ "$drill_mode" = true ]; then
  [ -z "$target_dir" ] || usage
  target_dir="$restore_root/monthly-drill-$("$date_bin" -u '+%Y%m%dT%H%M%SZ')-$$"
else
  [ -n "$target_dir" ] || usage
fi
if [ "$restore_latest" = true ]; then
  [ -z "$requested_backup_id" ] || usage
else
  [[ "$requested_backup_id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]] || usage
fi
target_dir=$(require_restore_target "$target_dir")

started_monotonic=$(monotonic_seconds)
result_path="$target_dir/restore-result.json"
result_backup_id=${requested_backup_id:-monthly-pending}

cleanup() {
  local status=$?

  trap - EXIT
  rm -f -- "$identity_file" "$rclone_config" "$recovery_manifest" \
    "$authenticated_success_file" "$signed_claim_file"
  [ -z "$artifact_dir" ] || rm -rf -- "$artifact_dir"
  [ -z "$work_dir" ] || rm -rf -- "$work_dir"
  find "$runtime_dir" -maxdepth 1 -type f \
    -name "*-tar-*.$$" -delete 2>/dev/null || true
  if [ "$status" -ne 0 ] && [ ! -f "$result_path" ]; then
    [ "$status" -ne 124 ] || failure_category=restore_timeout
    publish_restore_failure_result "$result_path" "$result_backup_id" latest \
      "$started_monotonic" "$failure_category" >/dev/null 2>&1 || true
  fi
  if [ "$drill_mode" = true ] && [ -d "$target_dir" ] && \
    [ -f "$result_path" ]; then
    publish_drill_evidence monthly-drill "$target_dir" >/dev/null 2>&1 || \
      rm -rf -- "$target_dir"
  fi
  exit "$status"
}
trap cleanup EXIT

r2_account_id=$(require_scalar_value R2_ACCOUNT_ID "${R2_ACCOUNT_ID:-}")
[[ "$r2_account_id" =~ ^[A-Fa-f0-9]{32}$ ]] || usage
r2_bucket=$(require_scalar_value R2_ARCHIVE_BUCKET "${R2_ARCHIVE_BUCKET:-}")
[[ "$r2_bucket" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] && \
  [[ "$r2_bucket" != *..* ]] || usage
recovery_secret_id=$(require_scalar_value POSTGRES_BACKUP_RECOVERY_SECRET_ID \
  "${POSTGRES_BACKUP_RECOVERY_SECRET_ID:-}")
aws_region=$(require_scalar_value AWS_REGION "${AWS_REGION:-}")
trusted_kms_key_ids_value=$(require_scalar_value \
  POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS \
  "${POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS:-}")
IFS=',' read -r -a trusted_kms_key_ids <<<"$trusted_kms_key_ids_value"
[ "${#trusted_kms_key_ids[@]}" -gt 0 ] || usage
for trusted_kms_key_index in "${!trusted_kms_key_ids[@]}"; do
  trusted_kms_key_ids[$trusted_kms_key_index]=$(require_kms_key_arn \
    POSTGRES_BACKUP_TRUSTED_KMS_KEY_IDS \
    "${trusted_kms_key_ids[$trusted_kms_key_index]}") || usage
done
expected_service_name=$(require_scalar_value POSTGRES_BACKUP_SERVICE_NAME \
  "${POSTGRES_BACKUP_SERVICE_NAME:-}")
expected_environment=$(require_scalar_value POSTGRES_BACKUP_ENVIRONMENT \
  "${POSTGRES_BACKUP_ENVIRONMENT:-}")

umask 077
install -d -m 0700 "$runtime_dir"
work_dir=$(mktemp -d "$restore_root/.monthly-download.XXXXXX")
artifact_dir="$target_dir/.restore-artifacts"
install -d -m 0700 "$artifact_dir"
identity_file=$(mktemp "$runtime_dir/monthly-age-identity.XXXXXX")
rclone_config=$(mktemp "$runtime_dir/monthly-restore-rclone.XXXXXX")
recovery_manifest=$(mktemp "$runtime_dir/monthly-recovery-manifest.XXXXXX")
chmod 0600 "$identity_file" "$rclone_config" "$recovery_manifest"

access_key=$(require_scalar_file R2_ARCHIVE_ACCESS_KEY_ID \
  "${R2_ARCHIVE_ACCESS_KEY_ID_FILE:-}")
secret_key=$(require_scalar_file R2_ARCHIVE_SECRET_ACCESS_KEY \
  "${R2_ARCHIVE_SECRET_ACCESS_KEY_FILE:-}")
cat >"$rclone_config" <<EOF
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

authenticated_success_file=$(mktemp "$runtime_dir/monthly-success-candidate.XXXXXX")
signed_claim_file=$(mktemp "$runtime_dir/monthly-signed-claim.XXXXXX")
chmod 0600 "$authenticated_success_file" "$signed_claim_file"
now_backup_timestamp=$($date_bin -u '+%Y%m%dT%H%M%SZ')
[[ "$now_backup_timestamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 70

authenticate_candidate() {
  local candidate_path=$1
  local candidate_year
  local candidate_month
  local candidate_backup_id
  local candidate_timestamp
  local candidate_kind
  local marker_key_id
  local marker_mac
  local mac_valid
  local claim_metadata
  local claim_backup_id
  local claim_published_at
  local claim_timestamp
  local claim_upload_hash
  local claim_artifact_count
  local claim_ciphertext_bytes
  local claim_artifact_bytes
  local claim_expanded_bytes

  if [[ "$candidate_path" =~ ^([0-9]{4})/(0[1-9]|1[0-2])/_LATEST\.json$ ]]; then
    [ "$restore_latest" = true ] || return 1
    candidate_kind=latest
    candidate_year=${BASH_REMATCH[1]}
    candidate_month=${BASH_REMATCH[2]}
    candidate_backup_id=''
  elif [[ "$candidate_path" =~ ^([0-9]{4})/(0[1-9]|1[0-2])/([0-9]{8}T[0-9]{6}Z-[0-9]+)/_SUCCESS\.json$ ]]; then
    [ "$restore_latest" != true ] || return 1
    candidate_kind=success
    candidate_year=${BASH_REMATCH[1]}
    candidate_month=${BASH_REMATCH[2]}
    candidate_backup_id=${BASH_REMATCH[3]}
    [ "$candidate_backup_id" = "$requested_backup_id" ] || return 1
  else
    return 1
  fi

  run_with_restore_deadline "$started_monotonic" \
    "$rclone_bin" --config "$rclone_config" cat \
    "r2:$r2_bucket/monthly/$candidate_path" \
    >"$authenticated_success_file" 2>/dev/null || return 1
  marker_key_id=$(jq -er \
    '.authentication | select(.scheme == "aws-kms-hmac-sha256") |
     .keyId | strings' "$authenticated_success_file" 2>/dev/null) || return 1
  marker_key_id=$(require_kms_key_arn 'monthly marker KMS KeyId' \
    "$marker_key_id" 2>/dev/null) || return 1
  kms_key_is_trusted "$marker_key_id" || return 1
  marker_mac=$(jq -er \
    '.authentication.macBase64 | strings |
     select(test("^[A-Za-z0-9+/]+={0,2}$"))' \
    "$authenticated_success_file" 2>/dev/null) || return 1
  jq -jr '.signedPayloadBase64 | strings | @base64d' \
    "$authenticated_success_file" >"$signed_claim_file" 2>/dev/null || return 1
  [ -s "$signed_claim_file" ] || return 1
  mac_valid=$(run_with_restore_deadline "$started_monotonic" \
    "$aws_bin" kms verify-mac --region "$aws_region" --key-id "$marker_key_id" \
    --mac-algorithm HMAC_SHA_256 --message "fileb://$signed_claim_file" \
    --mac "$marker_mac" --query MacValid --output text 2>/dev/null) || return 1
  [ "$mac_valid" = True ] || return 1

  claim_metadata=$(jq -er '
    select(type == "object") |
    [.backupId, .publishedAt, .uploadManifestSha256, .artifactCount,
     .ciphertextBytes, .artifactBytes, .expandedBytes] |
    select(.[0] | type == "string") |
    select(.[1] | type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")) |
    select(.[2] | type == "string" and test("^[A-Fa-f0-9]{64}$")) |
    select(.[3:] | all(.[]; type == "number" and floor == . and . > 0)) | @tsv
  ' "$signed_claim_file" 2>/dev/null) || return 1
  IFS=$'\t' read -r claim_backup_id claim_published_at claim_upload_hash \
    claim_artifact_count claim_ciphertext_bytes claim_artifact_bytes \
    claim_expanded_bytes \
    <<<"$claim_metadata"
  [[ "$claim_backup_id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]] || return 1
  if [ "$candidate_kind" = success ]; then
    [ "$claim_backup_id" = "$candidate_backup_id" ] || return 1
  else
    candidate_backup_id=$claim_backup_id
  fi
  candidate_timestamp=${candidate_backup_id%%-*}
  [ "${candidate_timestamp:0:4}" = "$candidate_year" ] && \
    [ "${candidate_timestamp:4:2}" = "$candidate_month" ] || return 1
  [[ "$candidate_timestamp" > "$now_backup_timestamp" ]] && return 1
  claim_timestamp=${claim_published_at//[-:]/}
  [[ "$claim_timestamp" > "$now_backup_timestamp" ]] && return 1
  jq -e \
    --arg backupId "$claim_backup_id" \
    --arg publishedAt "$claim_published_at" \
    --arg uploadManifestSha256 "$claim_upload_hash" \
    --argjson artifactCount "$claim_artifact_count" \
    --argjson ciphertextBytes "$claim_ciphertext_bytes" \
    --argjson artifactBytes "$claim_artifact_bytes" \
    --argjson expandedBytes "$claim_expanded_bytes" \
    '.schemaVersion == 2 and .backupId == $backupId and
     .publishedAt == $publishedAt and
     .uploadManifestSha256 == $uploadManifestSha256 and
     .artifactCount == $artifactCount and
     .ciphertextBytes == $ciphertextBytes and .artifactBytes == $artifactBytes and
     .expandedBytes == $expandedBytes' \
    "$authenticated_success_file" >/dev/null 2>&1 || return 1

  year=$candidate_year
  month=$candidate_month
  backup_id=$candidate_backup_id
  expected_upload_manifest_hash=$claim_upload_hash
  expected_artifact_bytes=$claim_artifact_bytes
  expected_ciphertext_bytes=$claim_ciphertext_bytes
  expected_expanded_bytes=$claim_expanded_bytes
}

selected_success=''
failure_category=monthly_selection_failed
if [ "$restore_latest" = true ]; then
  now_year=$((10#${now_backup_timestamp:0:4}))
  now_month=$((10#${now_backup_timestamp:4:2}))
  now_month_index=$((now_year * 12 + now_month - 1))
  for month_offset in {0..13}; do
    candidate_month_index=$((now_month_index - month_offset))
    candidate_year=$((candidate_month_index / 12))
    candidate_month=$((candidate_month_index % 12 + 1))
    printf -v candidate_success '%04d/%02d/_LATEST.json' \
      "$candidate_year" "$candidate_month"
    if authenticate_candidate "$candidate_success"; then
      selected_success=$candidate_success
      break
    fi
  done
else
  requested_year=${requested_backup_id:0:4}
  requested_month=${requested_backup_id:4:2}
  candidate_success="$requested_year/$requested_month/$requested_backup_id/_SUCCESS.json"
  if authenticate_candidate "$candidate_success"; then
    selected_success=$candidate_success
  fi
fi
[ -n "$selected_success" ] || {
  printf 'no authenticated eligible monthly recovery point was found\n' >&2
  exit 66
}
result_backup_id=$backup_id
remote_prefix="r2:$r2_bucket/monthly/$year/$month/$backup_id"

failure_category=restore_capacity_failed
require_restore_capacity \
  "$((expected_ciphertext_bytes + expected_artifact_bytes +
    (expected_expanded_bytes * 5 + 3) / 4))" || exit $?

failure_category=monthly_download_failed
run_with_restore_deadline "$started_monotonic" \
  "$rclone_bin" --config "$rclone_config" copy "$remote_prefix" "$work_dir" \
  --immutable >/dev/null
success_file="$work_dir/_SUCCESS.json"
upload_manifest="$work_dir/upload-manifest.json"
failure_category=monthly_outer_manifest_failed
[ -f "$success_file" ] && [ -f "$upload_manifest" ] || exit 66
cmp -s -- "$success_file" "$authenticated_success_file" || exit 66
sha256_restore_file() {
  run_with_restore_deadline "$started_monotonic" "$sha256_bin" "$1" | \
    awk '{print $1}'
}

actual_upload_manifest_hash=$(sha256_restore_file "$upload_manifest")
[ "$actual_upload_manifest_hash" = "$expected_upload_manifest_hash" ] || exit 66

file_size_bytes() {
  "$stat_bin" -c '%s' "$1" 2>/dev/null || "$stat_bin" -f '%z' "$1"
}

outer_artifacts=$(jq -cer '
  .artifacts | arrays |
  select(all(.[];
    (.name | type == "string" and test("^[A-Za-z0-9][A-Za-z0-9._-]{0,255}\\.age$")) and
    (.sizeBytes | type == "number" and floor == . and . > 0) and
    (.sha256 | type == "string" and test("^[A-Fa-f0-9]{64}$"))))
' "$upload_manifest")
jq -e 'any(.[]; .name == "recovery-manifest.json.age")' \
  <<<"$outer_artifacts" >/dev/null || exit 66
while IFS=$'\t' read -r name size_bytes expected_hash; do
  ciphertext="$work_dir/$name"
  [ -f "$ciphertext" ] && [ ! -L "$ciphertext" ] || exit 66
  [ "$(file_size_bytes "$ciphertext")" -eq "$size_bytes" ] || exit 66
  [ "$(sha256_restore_file "$ciphertext")" = "$expected_hash" ] || exit 66
done < <(jq -r '.[] | [.name, .sizeBytes, .sha256] | @tsv' <<<"$outer_artifacts")

failure_category=recovery_identity_failed
run_with_restore_deadline "$started_monotonic" \
  "$aws_bin" secretsmanager get-secret-value --region "$aws_region" \
  --secret-id "$recovery_secret_id" --query SecretString --output text \
  >"$identity_file"
chmod 0600 "$identity_file"
identity=$(tr -d '\n' <"$identity_file")
[[ "$identity" =~ ^AGE-SECRET-KEY-1[0-9A-Z]+$ ]] || {
  printf 'monthly recovery identity is invalid\n' >&2
  exit 67
}

recovery_cipher="$work_dir/recovery-manifest.json.age"
[ -f "$recovery_cipher" ] || exit 66
failure_category=monthly_decryption_failed
run_with_restore_deadline "$started_monotonic" \
  "$age_bin" --decrypt --identity "$identity_file" \
  --output "$recovery_manifest" "$recovery_cipher" >/dev/null

manifest_backup_id=$(jq -er '.backupId | strings' "$recovery_manifest")
failure_category=monthly_inner_manifest_failed
[ "$manifest_backup_id" = "$backup_id" ] || exit 66
[ "$(jq -er '.serviceName | strings' "$recovery_manifest")" = \
  "$expected_service_name" ] || exit 66
[ "$(jq -er '.environment | strings' "$recovery_manifest")" = \
  "$expected_environment" ] || exit 66
expected_system_identifier=$(jq -er \
  '.systemIdentifier | strings | select(test("^[0-9]+$"))' "$recovery_manifest")
expected_major=$(jq -er \
  '.postgresqlMajorVersion | numbers | select(floor == . and . > 0)' \
  "$recovery_manifest")
[ "$(jq -er '.expandedBytes | numbers | select(floor == . and . > 0)' \
  "$recovery_manifest")" = "$expected_expanded_bytes" ] || exit 66

inner_artifacts=$(jq -cer '
  .artifacts | arrays |
  select(all(.[];
    (.name | type == "string" and test("^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$")) and
    (.sizeBytes | type == "number" and floor == . and . > 0) and
    (.sha256 | type == "string" and test("^[A-Fa-f0-9]{64}$"))))
' "$recovery_manifest")
while IFS=$'\t' read -r name size_bytes expected_hash; do
  ciphertext="$work_dir/$name.age"
  plaintext="$artifact_dir/$name"
  jq -e --arg name "$name.age" 'any(.[]; .name == $name)' \
    <<<"$outer_artifacts" >/dev/null || exit 66
  [ -f "$ciphertext" ] || exit 66
  run_with_restore_deadline "$started_monotonic" \
    "$age_bin" --decrypt --identity "$identity_file" \
    --output "$plaintext" "$ciphertext" >/dev/null
  [ "$(file_size_bytes "$plaintext")" -eq "$size_bytes" ] || exit 66
  [ "$(sha256_restore_file "$plaintext")" = "$expected_hash" ] || exit 66
done < <(jq -r '.[] | [.name, .sizeBytes, .sha256] | @tsv' <<<"$inner_artifacts")

rm -f -- "$identity_file"
identity_file=''

[ -f "$artifact_dir/base.tar.zst" ] && [ -f "$artifact_dir/pg_wal.tar" ] && \
  [ -f "$artifact_dir/backup_manifest" ] || exit 66

failure_category=monthly_extraction_failed

validate_tar_members() {
  local listing=$1

  run_with_restore_deadline "$started_monotonic" awk -F/ '
    !/^[A-Za-z0-9._\/-]+$/ {exit 1}
    /^\// {exit 1}
    {for (i = 1; i <= NF; i++) if ($i == "..") exit 1}
  ' "$listing"
}

validate_tar_links() {
  local listing=$1
  local allow_tablespace_links=$2

  run_with_restore_deadline "$started_monotonic" \
    awk -v allowTablespaces="$allow_tablespace_links" '
    $1 !~ /^[-dl]/ {exit 1}
    $1 ~ /^l/ {
      if (allowTablespaces != "true" || $6 !~ /^\.\/pg_tblspc\/[0-9]+$/) exit 1
    }
  ' "$listing"
}

run_zstd_tar() {
  local archive=$1
  shift

  run_restore_pipeline_with_deadline "$started_monotonic" \
    '"$1" --decompress --stdout "$3" | "$2" "${@:4}"' \
    "$zstd_bin" "$tar_bin" "$archive" "$@"
}

base_listing="$runtime_dir/base-tar-list.$$"
base_verbose_listing="$runtime_dir/base-tar-verbose-list.$$"
run_zstd_tar "$artifact_dir/base.tar.zst" -tf - >"$base_listing"
run_zstd_tar "$artifact_dir/base.tar.zst" -tvf - >"$base_verbose_listing"
validate_tar_members "$base_listing"
validate_tar_links "$base_verbose_listing" true
run_zstd_tar "$artifact_dir/base.tar.zst" -xf - -C "$target_dir" \
  --exclude './pg_tblspc/*' --exclude 'pg_tblspc/*'
install -d -m 0700 "$target_dir/pg_tblspc"
rm -f -- "$base_listing" "$base_verbose_listing"

wal_listing="$runtime_dir/wal-tar-list.$$"
wal_verbose_listing="$runtime_dir/wal-tar-verbose-list.$$"
run_with_restore_deadline "$started_monotonic" \
  "$tar_bin" -tf "$artifact_dir/pg_wal.tar" >"$wal_listing"
run_with_restore_deadline "$started_monotonic" \
  "$tar_bin" -tvf "$artifact_dir/pg_wal.tar" >"$wal_verbose_listing"
validate_tar_members "$wal_listing"
validate_tar_links "$wal_verbose_listing" false
install -d -m 0700 "$target_dir/pg_wal"
run_with_restore_deadline "$started_monotonic" \
  "$tar_bin" -xf "$artifact_dir/pg_wal.tar" -C "$target_dir/pg_wal"
rm -f -- "$wal_listing" "$wal_verbose_listing"
install -m 0600 "$artifact_dir/backup_manifest" "$target_dir/backup_manifest"

shopt -s nullglob
for tablespace_tar in "$artifact_dir"/[0-9]*.tar.zst; do
  tablespace_name=$(basename -- "$tablespace_tar" .tar.zst)
  [[ "$tablespace_name" =~ ^[0-9]+$ ]] || exit 66
  tablespace_dir="$target_dir/tablespaces/$tablespace_name"
  install -d -m 0700 "$tablespace_dir" "$target_dir/pg_tblspc"
  table_listing="$runtime_dir/tablespace-tar-list.$tablespace_name.$$"
  table_verbose_listing="$runtime_dir/tablespace-tar-verbose-list.$tablespace_name.$$"
  run_zstd_tar "$tablespace_tar" -tf - >"$table_listing"
  run_zstd_tar "$tablespace_tar" -tvf - >"$table_verbose_listing"
  validate_tar_members "$table_listing"
  validate_tar_links "$table_verbose_listing" false
  run_zstd_tar "$tablespace_tar" -xf - -C "$tablespace_dir"
  rm -f -- "$table_listing" "$table_verbose_listing"
  rm -f -- "$target_dir/pg_tblspc/$tablespace_name"
  ln -s "$tablespace_dir" "$target_dir/pg_tblspc/$tablespace_name"
done

rm -rf -- "$artifact_dir"
artifact_dir=''

export POSTGRES_EXPECTED_MAJOR_VERSION="$expected_major"
export RESTORE_VERIFY_RESULT_PATH=${RESTORE_VERIFY_RESULT_PATH:-$target_dir/restore-result.json}
failure_category=restore_verification_failed
run_with_restore_deadline "$started_monotonic" \
  "$verify_bin" \
  --target-dir "$target_dir" \
  --backup-id "$backup_id" \
  --target-time latest \
  --started-monotonic "$started_monotonic" \
  --expected-system-identifier "$expected_system_identifier"

if [ "$drill_mode" = true ]; then
  publish_drill_evidence monthly-drill "$target_dir"
fi
