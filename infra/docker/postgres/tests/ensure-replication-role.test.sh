#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
. "$ROOT/infra/docker/postgres/tests/test-lib.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
printf 'replication-pass\n' >"$tmp/password"

cat >"$tmp/bin/psql" <<'EOF'
#!/usr/bin/env sh
printf '%s\n' "$*" >>"$PSQL_ARGUMENTS"
cat >>"$PSQL_INPUT"
case " $* " in
  *' --quiet '*) ;;
  *) printf 'CREATE ROLE\nALTER ROLE\n' ;;
esac
printf 't\n'
EOF
chmod +x "$tmp/bin/psql"

PATH="$tmp/bin:$PATH" \
  PSQL_ARGUMENTS="$tmp/arguments" PSQL_INPUT="$tmp/input" \
  POSTGRES_REPLICATION_PASSWORD_FILE="$tmp/password" \
  "$ROOT/infra/docker/postgres/scripts/ensure-replication-role.sh" \
  >"$tmp/output"

assert_file_contains "$tmp/arguments" '-v role=postgres_backup'
assert_file_contains "$tmp/arguments" '-v password=replication-pass'
assert_file_contains "$tmp/input" "CREATE ROLE %I WITH LOGIN REPLICATION PASSWORD %L"
assert_file_contains "$tmp/input" "ALTER ROLE %I WITH LOGIN REPLICATION PASSWORD %L"
assert_file_contains "$tmp/input" "rolreplication"
if grep -Fq 'replication-pass' "$tmp/output"; then
  fail 'replication password leaked to stdout'
fi
printf 'ok - replication role setup\n'
