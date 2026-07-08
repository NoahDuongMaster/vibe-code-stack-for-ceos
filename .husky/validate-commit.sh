#!/bin/sh
#
# Validate the commit message header against the Conventional Commits spec.
#   https://www.conventionalcommits.org/
#
# Usage: validate-commit.sh -m <path-to-commit-msg-file>
# (invoked by the commit-msg hook as: sh ./.husky/validate-commit.sh -m "$1")

set -u

commit_msg_file=""
while getopts "m:" opt; do
  case "$opt" in
    m) commit_msg_file="$OPTARG" ;;
    *) ;;
  esac
done

if [ -z "$commit_msg_file" ] || [ ! -f "$commit_msg_file" ]; then
  echo "❌ validate-commit: missing commit message file (expected -m <path>)." >&2
  exit 1
fi

# The header is the first non-empty, non-comment line of the message.
header="$(grep -vE '^[[:space:]]*#' "$commit_msg_file" | grep -vE '^[[:space:]]*$' | head -n1)"

# Let merge / revert / fixup / squash / empty commits through untouched.
case "$header" in
  "Merge "* | "Revert "* | "fixup!"* | "squash!"* | "")
    exit 0
    ;;
esac

# Conventional Commits type set (matches @commitlint/config-conventional).
types="build|chore|ci|docs|feat|fix|hotfix|perf|refactor|release|revert|style|test"

# <type>[(scope)][!]: <description>   — scope and ! are optional.
pattern="^(${types})(\([a-z0-9._/-]+\))?(!)?: .+"

if printf '%s\n' "$header" | grep -Eq "$pattern"; then
  # Non-blocking guidance: keep the subject line readable.
  header_len=$(printf '%s' "$header" | wc -c | tr -d ' ')
  if [ "$header_len" -gt 100 ]; then
    echo "⚠️  Commit header is ${header_len} characters (recommended ≤ 100)."
  fi
  exit 0
fi

cat >&2 <<EOF
❌ Invalid commit message — it must follow Conventional Commits:

      <type>[(scope)][!]: <description>

  type   : ${types}
  scope  : optional, e.g. (dapp), (api-node)
  !      : optional, marks a breaking change

  Examples:
      feat(dapp): add user profile page
      fix(api-node): handle empty echo payload
      refactor!: drop the legacy RPC client
      docs: update the README

  Your commit header was:
      ${header}

  Spec: https://www.conventionalcommits.org/
EOF
exit 1
