#!/bin/sh
#
# Validate the current branch name against a Conventional-Commits-aligned
# naming convention. Invoked by the pre-push hook.
#
#   <type>[(scope)]/<short-kebab-description>

set -u

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

# Long-lived / automated branches are exempt from the convention.
case "$branch" in
  main | master | develop | dev | staging | release | HEAD | "")
    exit 0
    ;;
  release/* | hotfix/* | dependabot/* | renovate/*)
    exit 0
    ;;
esac

types="build|chore|ci|docs|feat|fix|hotfix|perf|refactor|release|revert|style|test"

# <type>[(scope)]/<kebab-description>  — scope is optional.
pattern="^(${types})(\([a-z0-9._/-]+\))?/[a-z0-9][a-z0-9._/-]*$"

if printf '%s\n' "$branch" | grep -Eq "$pattern"; then
  exit 0
fi

cat >&2 <<EOF
❌ Invalid branch name: "${branch}"

  Use:  <type>[(scope)]/<short-kebab-description>

  type : ${types}
  Examples:
      feat/user-profile
      fix/issue-42-login-redirect
      chore/upgrade-turborepo
      feat(dapp)/issue-42-user-profile

  (main, develop, staging, release/*, hotfix/* are exempt.)
EOF
exit 1
