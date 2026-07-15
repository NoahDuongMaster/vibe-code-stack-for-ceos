#!/usr/bin/env bash
set -Eeuo pipefail

require_backup_mode() {
  case "$1" in
    enabled | disabled) printf '%s' "$1" ;;
    *)
      printf 'POSTGRES_BACKUP_MODE must be enabled or disabled\n' >&2
      return 1
      ;;
  esac
}

require_scalar_value() {
  local name=$1
  local value=$2

  [ -n "$value" ] || {
    printf '%s is required\n' "$name" >&2
    return 1
  }

  case "$value" in
    *$'\n'* | *$'\r'*)
      printf '%s must contain exactly one scalar value\n' "$name" >&2
      return 1
      ;;
  esac

  printf '%s' "$value"
}

require_scalar_file() {
  local name=$1
  local path=$2
  local value

  [ -n "$path" ] || {
    printf '%s file path is required\n' "$name" >&2
    return 1
  }
  [ -r "$path" ] || {
    printf '%s file is not readable: %s\n' "$name" "$path" >&2
    return 1
  }

  value=$(cat -- "$path")
  [ -n "$value" ] || {
    printf '%s must not be empty\n' "$name" >&2
    return 1
  }

  case "$value" in
    *$'\n'* | *$'\r'*)
      printf '%s must contain exactly one scalar value\n' "$name" >&2
      return 1
      ;;
  esac

  printf '%s' "$value"
}

atomic_write_json() {
  local output_path=$1
  local temporary_path
  local status
  shift

  umask 077
  temporary_path=$(mktemp "${output_path}.tmp.XXXXXX")
  if jq "$@" >"$temporary_path"; then
    chmod 0600 "$temporary_path"
    mv -f -- "$temporary_path" "$output_path"
    return 0
  else
    status=$?
  fi

  rm -f -- "$temporary_path"
  return "$status"
}

json_log() {
  local level=$1
  local event=$2
  local message=$3
  local timestamp

  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  jq -cn \
    --arg timestamp "$timestamp" \
    --arg level "$level" \
    --arg event "$event" \
    --arg message "$message" \
    '{timestamp:$timestamp,level:$level,event:$event,message:$message}'
}

retry_with_backoff() {
  local attempts=4
  local attempt=1
  local status
  local output_path
  local normalized_output
  local -a delays=(5 15 45)

  output_path=$(mktemp)
  while [ "$attempt" -le "$attempts" ]; do
    if "$@" >"$output_path" 2>&1; then
      cat -- "$output_path"
      rm -f -- "$output_path"
      return 0
    else
      status=$?
    fi

    cat -- "$output_path" >&2
    normalized_output=$(tr '[:upper:]' '[:lower:]' <"$output_path")
    if printf '%s' "$normalized_output" | grep -Eq \
      'authentication|authorization|access[ _-]?denied|permission[ _-]?denied|invalidaccesskeyid|signaturedoesnotmatch|do not match|(system[ -]?id|database).*(mismatch|do not match)|dbmismatcherror|backupmismatcherror|archivemismatcherror|repository.*(identity|mismatch)|stanza.*(identity|mismatch)'; then
      rm -f -- "$output_path"
      return "$status"
    fi

    if [ "$attempt" -eq "$attempts" ]; then
      rm -f -- "$output_path"
      return "$status"
    fi

    sleep "${delays[$((attempt - 1))]}"
    attempt=$((attempt + 1))
  done
}
