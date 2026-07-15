#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
. "$SCRIPT_DIR/backup-lib.sh"

readonly EX_TEMPFAIL=75
stage_root=${POSTGRES_BACKUP_STAGE_DIR:-/var/lib/postgres-backup/stage}
state_dir=${POSTGRES_BACKUP_STATE_DIR:-/var/lib/postgres-backup/state}
lock_path=${POSTGRES_BACKUP_LOCK_PATH:-$state_dir/backup-job.lock}
flock_bin=${BACKUP_FLOCK_BIN:-flock}
lock_fd=9
owns_lock=false

case "$#" in
  0)
    ;;
  2)
    [ "$1" = --lock-held-fd ] && [ "$2" = "$lock_fd" ] || {
      printf 'usage: cleanup-monthly-orphans.sh [--lock-held-fd 9]\n' >&2
      exit 64
    }
    ;;
  *)
    printf 'usage: cleanup-monthly-orphans.sh [--lock-held-fd 9]\n' >&2
    exit 64
    ;;
esac

install -d -m 0700 "$stage_root" "$state_dir"
umask 077
if [ "$#" -eq 0 ]; then
  exec 9>"$lock_path"
  owns_lock=true
elif [ ! "$lock_path" -ef "/dev/fd/$lock_fd" ]; then
  printf 'borrowed backup-job lock descriptor does not match the lock path\n' >&2
  exit 64
fi
if ! "$flock_bin" -n "$lock_fd"; then
  printf 'monthly orphan cleanup requires the held backup-job lock\n' >&2
  exit "$EX_TEMPFAIL"
fi

publish_size_state_from_marker() {
  local backup_id=$1
  local marker=$2
  local metadata
  local artifact_bytes
  local published_at
  local current_backup_id=''
  local size_state="$state_dir/monthly.last-size.json"

  metadata=$(jq -er --arg backupId "$backup_id" \
    'select(.schemaVersion == 1 and .backupId == $backupId) |
     select(.artifactBytes | type == "number" and floor == . and . > 0) |
     select(.publishedAt | type == "string") |
     [.artifactBytes, .publishedAt] | @tsv' "$marker" 2>/dev/null) || return 1
  IFS=$'\t' read -r artifact_bytes published_at <<<"$metadata"
  [[ "$published_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || \
    return 1

  if [ -f "$size_state" ]; then
    current_backup_id=$(jq -er '.backupId | strings' "$size_state" 2>/dev/null || true)
  fi
  if [[ "$current_backup_id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]] && \
    [[ "$current_backup_id" > "$backup_id" ]]; then
    return 0
  fi

  atomic_write_json "$size_state" -n \
    --arg backupId "$backup_id" \
    --argjson artifactBytes "$artifact_bytes" \
    --arg recordedAt "$published_at" \
    '{backupId:$backupId,artifactBytes:$artifactBytes,recordedAt:$recordedAt}'
}

shopt -s nullglob
for candidate in "$stage_root"/*; do
  [ -d "$candidate" ] && [ ! -L "$candidate" ] || continue
  backup_id=$(basename -- "$candidate")
  [[ "$backup_id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9]+$ ]] || continue
  plaintext_path="$candidate/plain"
  plaintext_removed=false
  if [ -L "$plaintext_path" ]; then
    rm -f -- "$plaintext_path"
    plaintext_removed=true
  elif [ -d "$plaintext_path" ]; then
    rm -rf -- "$plaintext_path"
    plaintext_removed=true
  fi
  if [ "$plaintext_removed" = true ]; then
    json_log warn monthly_plaintext_orphan_removed "$backup_id"
  fi

  pending_marker="$candidate/.remote-success-pending.json"
  if [ -f "$pending_marker" ] && [ ! -L "$pending_marker" ]; then
    if publish_size_state_from_marker "$backup_id" "$pending_marker"; then
      json_log warn monthly_pending_publication_size_reconciled "$backup_id"
    else
      json_log error monthly_pending_publication_marker_invalid "$backup_id" >&2
    fi
  fi

  published_marker="$candidate/.remote-success-verified.json"
  if [ -f "$published_marker" ] && [ ! -L "$published_marker" ] && \
    jq -e --arg backupId "$backup_id" \
      '.schemaVersion == 1 and .backupId == $backupId and
       .remoteSuccessVerified == true' "$published_marker" >/dev/null 2>&1 && \
    publish_size_state_from_marker "$backup_id" "$published_marker"; then
    ciphertext_path="$candidate/cipher"
    if [ -L "$ciphertext_path" ]; then
      rm -f -- "$ciphertext_path"
    elif [ -d "$ciphertext_path" ]; then
      rm -rf -- "$ciphertext_path"
    fi
    rm -f -- "$candidate/_SUCCESS.pending.json" "$pending_marker" \
      "$published_marker"
    rmdir -- "$candidate" 2>/dev/null || true
    json_log warn monthly_published_ciphertext_orphan_removed "$backup_id"
  fi
done

if [ "$owns_lock" = true ]; then
  "$flock_bin" -u "$lock_fd"
  exec 9>&-
fi
