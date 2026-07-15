#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

assert_file_contains() {
  grep -Fq -- "$2" "$1" || fail "$1 does not contain $2"
}

file_mode() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"
}

assert_file_mode() {
  [ "$(file_mode "$1")" = "$2" ] || fail "$1 mode is not $2"
}

assert_eq() {
  [ "$1" = "$2" ] || fail "expected [$2], got [$1]"
}
