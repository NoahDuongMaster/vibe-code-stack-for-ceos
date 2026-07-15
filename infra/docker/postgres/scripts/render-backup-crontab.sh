#!/usr/bin/env bash
set -Eeuo pipefail

output_path=${1:-/run/postgres-backup-cron/postgres}

validate_cron_number() {
  local name=$1
  local value=$2
  local minimum=$3
  local maximum=$4
  local numeric_value

  [[ "$value" =~ ^[0-9]+$ ]] && [ "${#value}" -le 2 ] || {
    printf '%s contains an invalid cron number\n' "$name" >&2
    return 1
  }
  numeric_value=$((10#$value))
  [ "$numeric_value" -ge "$minimum" ] && [ "$numeric_value" -le "$maximum" ] || {
    printf '%s contains a cron number outside its allowed range\n' "$name" >&2
    return 1
  }
}

validate_cron_field() {
  local name=$1
  local value=$2
  local minimum=$3
  local maximum=$4
  local range_size=$((maximum - minimum + 1))
  local item
  local base
  local step
  local start
  local end
  local -a items=()

  case "$value" in
    '' | ,* | *, | *,,*)
      printf '%s contains an empty cron list item\n' "$name" >&2
      return 1
      ;;
  esac
  IFS=',' read -r -a items <<<"$value"
  for item in "${items[@]}"; do
    base=$item
    step=''
    if [[ "$item" == */* ]]; then
      base=${item%%/*}
      step=${item#*/}
      [[ "$step" != */* ]] || {
        printf '%s contains more than one cron step separator\n' "$name" >&2
        return 1
      }
      validate_cron_number "$name step" "$step" 1 "$range_size" || return 1
    fi

    if [ "$base" = '*' ]; then
      continue
    fi
    if [[ "$base" =~ ^[0-9]+$ ]]; then
      validate_cron_number "$name" "$base" "$minimum" "$maximum" || return 1
      continue
    fi
    if [[ "$base" =~ ^([0-9]+)-([0-9]+)$ ]]; then
      start=${BASH_REMATCH[1]}
      end=${BASH_REMATCH[2]}
      validate_cron_number "$name range start" "$start" "$minimum" "$maximum" || \
        return 1
      validate_cron_number "$name range end" "$end" "$minimum" "$maximum" || \
        return 1
      [ "$((10#$start))" -le "$((10#$end))" ] || {
        printf '%s contains a descending cron range\n' "$name" >&2
        return 1
      }
      continue
    fi
    printf '%s contains an invalid cron field expression\n' "$name" >&2
    return 1
  done
}

normalize_schedule() {
  local name=$1
  local value=$2
  local field
  local -a fields=()
  local -a field_names=(minute hour day-of-month month day-of-week)
  local -a field_minimums=(0 0 1 1 0)
  local -a field_maximums=(59 23 31 12 7)
  local index

  case "$value" in
    *$'\n'* | *$'\r'*)
      printf '%s must contain exactly one five-field cron expression\n' "$name" >&2
      return 1
      ;;
  esac
  read -r -a fields <<<"$value"
  [ "${#fields[@]}" -eq 5 ] || {
    printf '%s must contain exactly five cron fields\n' "$name" >&2
    return 1
  }
  for field in "${fields[@]}"; do
    [[ "$field" =~ ^[0-9*/,-]+$ ]] || {
      printf '%s contains an unsupported cron field\n' "$name" >&2
      return 1
    }
  done
  for index in "${!fields[@]}"; do
    validate_cron_field "$name ${field_names[$index]}" \
      "${fields[$index]}" "${field_minimums[$index]}" \
      "${field_maximums[$index]}" || return 1
  done
  printf '%s' "${fields[*]}"
}

incremental=$(normalize_schedule POSTGRES_BACKUP_CRON_INCREMENTAL \
  "${POSTGRES_BACKUP_CRON_INCREMENTAL:-5 * * * *}")
differential=$(normalize_schedule POSTGRES_BACKUP_CRON_DIFFERENTIAL \
  "${POSTGRES_BACKUP_CRON_DIFFERENTIAL:-0 2 * * 1-6}")
full=$(normalize_schedule POSTGRES_BACKUP_CRON_FULL \
  "${POSTGRES_BACKUP_CRON_FULL:-0 2 * * 0}")
check=$(normalize_schedule POSTGRES_BACKUP_CRON_CHECK \
  "${POSTGRES_BACKUP_CRON_CHECK:-15 */6 * * *}")
verify=$(normalize_schedule POSTGRES_BACKUP_CRON_VERIFY \
  "${POSTGRES_BACKUP_CRON_VERIFY:-30 3 * * 0}")
monthly=$(normalize_schedule POSTGRES_BACKUP_CRON_MONTHLY \
  "${POSTGRES_BACKUP_CRON_MONTHLY:-0 4 1 * *}")
pitr_drill=$(normalize_schedule POSTGRES_BACKUP_CRON_PITR_DRILL \
  "${POSTGRES_BACKUP_CRON_PITR_DRILL:-0 6 * * 0}")
monthly_drill=$(normalize_schedule POSTGRES_BACKUP_CRON_MONTHLY_DRILL \
  "${POSTGRES_BACKUP_CRON_MONTHLY_DRILL:-30 6 2 * *}")

install -d -m 0700 "$(dirname -- "$output_path")"
umask 077
temporary_path=$(mktemp "$output_path.tmp.XXXXXX")
cleanup() {
  rm -f -- "$temporary_path"
}
trap cleanup EXIT

cat >"$temporary_path" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${incremental} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh incremental pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=incr backup
${differential} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh differential pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=diff backup
${full} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh full pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc --type=full backup
${check} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh check pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc check
${verify} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh verify pgbackrest --config=/run/postgres-backup/pgbackrest.conf --stanza=trading-rpc verify
${monthly} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh monthly /usr/local/bin/postgres-backup/backup-monthly.sh
${pitr_drill} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh pitr-drill /usr/local/bin/postgres-backup/restore-pitr.sh --latest --drill
${monthly_drill} env POSTGRES_BACKUP_SCHEDULED_RUN=true /usr/local/bin/postgres-backup/run-backup-job.sh monthly-drill /usr/local/bin/postgres-backup/restore-monthly.sh --latest --drill
EOF

chmod 0600 "$temporary_path"
mv -f -- "$temporary_path" "$output_path"
trap - EXIT
