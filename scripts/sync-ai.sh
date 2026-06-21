#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# sync-ai.sh — Rebuild AI graphs after git pull/merge
#
# Called by:
#   - .husky/post-merge (automatic after git pull)
#   - Manually: ./scripts/sync-ai.sh
#
# Does:
#   1. Incremental CRG update (fast — only changed files)
#   2. Regenerate AI IDE configs if .ai/rules.md changed
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'

echo -e "${BOLD}Syncing AI tools...${RESET}"

# CRG incremental update
if command -v uvx >/dev/null 2>&1; then
  uvx code-review-graph update --repo "$ROOT" >/dev/null 2>&1 && echo -e "  ${GREEN}✓${RESET} code-review-graph updated" || echo -e "  ${YELLOW}⚠${RESET} CRG update failed"
elif command -v code-review-graph >/dev/null 2>&1; then
  code-review-graph update --repo "$ROOT" >/dev/null 2>&1 && echo -e "  ${GREEN}✓${RESET} code-review-graph updated" || echo -e "  ${YELLOW}⚠${RESET} CRG update failed"
fi

# Regen AI configs if rules changed
CHANGED=$(git diff HEAD~1 HEAD --name-only 2>/dev/null | grep "^\.ai/" || true)
if [ -n "$CHANGED" ]; then
  echo -e "  ${YELLOW}.ai/ changed — regenerating IDE configs${RESET}"
  bash "$ROOT/scripts/gen-ai-config.sh" 2>/dev/null || true
else
  echo -e "  ${GREEN}✓${RESET} .ai/ unchanged — skip regen"
fi

echo -e "${GREEN}Done.${RESET}"
