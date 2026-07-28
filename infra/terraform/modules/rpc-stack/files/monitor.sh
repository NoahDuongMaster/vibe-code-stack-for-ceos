#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck source=/dev/null
source "${VIBE_RPC_INFRA_ENV_FILE:-/etc/vibe-rpc/infra.env}"

compose_dir=${VIBE_RPC_COMPOSE_DIR:-/opt/vibe-rpc}
images_file="$compose_dir/images.env"
project="vibe-rpc-$DEPLOYMENT_ENVIRONMENT"
namespace=VibeCodeStack/RpcHost

compose() {
  docker compose \
    --project-name "$project" \
    --env-file "$images_file" \
    --file "$compose_dir/compose.yaml" "$@"
}

container_healthy=1
for service in postgres postgres-backup trading-rpc admin-rpc cloudflared; do
  container_id=$(compose ps --quiet "$service")
  if [ -z "$container_id" ]; then
    container_healthy=0
    continue
  fi

  state=$(docker inspect --format \
    '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
    "$container_id")
  [ "$state" = 'running|healthy' ] || container_healthy=0
done

backup_healthy=1
compose exec --no-TTY --user postgres postgres-backup \
  /usr/local/bin/postgres-backup/backup-health.sh >/dev/null 2>&1 || \
  backup_healthy=0

maximum_usage() {
  local mode=$1
  shift
  local maximum=0
  local usage
  for path in "$@"; do
    usage=$(df "$mode" "$path" | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')
    if [ "$usage" -gt "$maximum" ]; then maximum=$usage; fi
  done
  printf '%s' "$maximum"
}

disk_used=$(maximum_usage -P / /srv/vibe-rpc/postgres /srv/vibe-rpc/backup-stage /srv/vibe-rpc/restore-stage)
inode_used=$(maximum_usage -Pi / /srv/vibe-rpc/postgres /srv/vibe-rpc/backup-stage /srv/vibe-rpc/restore-stage)
memory_used=$(awk '
  /MemTotal:/ { total = $2 }
  /MemAvailable:/ { available = $2 }
  END { printf "%d", ((total - available) * 100) / total }
' "${VIBE_RPC_PROC_MEMINFO:-/proc/meminfo}")

metric_file=$(mktemp)
trap 'rm -f "$metric_file"' EXIT
jq -n \
  --arg environment "$DEPLOYMENT_ENVIRONMENT" \
  --argjson backup "$backup_healthy" \
  --argjson containers "$container_healthy" \
  --argjson disk "$disk_used" \
  --argjson inodes "$inode_used" \
  --argjson memory "$memory_used" \
  '[
    {MetricName:"BackupHealthy",Unit:"Count",Value:$backup},
    {MetricName:"ContainersHealthy",Unit:"Count",Value:$containers},
    {MetricName:"DiskUsedPercent",Unit:"Percent",Value:$disk},
    {MetricName:"InodeUsedPercent",Unit:"Percent",Value:$inodes},
    {MetricName:"MemoryUsedPercent",Unit:"Percent",Value:$memory}
  ] | map(. + {Dimensions:[{Name:"Environment",Value:$environment}]})' \
  >"$metric_file"

aws cloudwatch put-metric-data \
  --region "$AWS_REGION" \
  --namespace "$namespace" \
  --metric-data "file://$metric_file"

if [ "$backup_healthy" -ne 1 ] || [ "$container_healthy" -ne 1 ]; then
  exit 1
fi
