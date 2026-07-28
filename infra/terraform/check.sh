#!/usr/bin/env bash
set -Eeuo pipefail

terraform fmt -check -recursive infra/terraform

for environment in staging production; do
  directory="infra/terraform/environments/$environment"
  terraform -chdir="$directory" init -backend=false -input=false >/dev/null
  terraform -chdir="$directory" validate
done
