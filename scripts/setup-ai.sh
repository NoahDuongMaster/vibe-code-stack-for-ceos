#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# setup-ai.sh — One-time AI tooling setup for new team members
#
# What it does:
#   1. Installs code-review-graph (uvx) and builds the full graph
#   2. Installs graphify and builds the knowledge graph
#   3. Generates AI IDE configs from .ai/rules.md
#   4. Verifies everything works
#
# Usage:
#   ./scripts/setup-ai.sh        # full setup
#   ./scripts/setup-ai.sh --skip-graphify  # CRG only (faster)
#
# Prerequisites:
#   - Node.js >= 20 (already required by project)
#   - Python 3 (for graphify)
#   - uv / uvx (for code-review-graph): curl -LsSf https://astral.sh/uv/install.sh | sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'
SKIP_GRAPHIFY=false
[[ "${1:-}" == "--skip-graphify" ]] && SKIP_GRAPHIFY=true

echo -e "${BOLD}━━━ AI Tooling Setup ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

# ── 1. Check prerequisites ───────────────────────────────────────────────────
echo -e "\n${BOLD}[1/5] Prerequisites${RESET}"

command -v node >/dev/null 2>&1 && echo -e "  ${GREEN}✓${RESET} Node.js $(node -v)" || { echo -e "  ${RED}✗ Node.js not found${RESET}"; exit 1; }
command -v python3 >/dev/null 2>&1 && echo -e "  ${GREEN}✓${RESET} Python3" || echo -e "  ${YELLOW}⚠ Python3 not found — graphify won't work${RESET}"

if command -v uvx >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${RESET} uvx (for code-review-graph)"
else
  echo -e "  ${YELLOW}⚠ uvx not found. Installing uv...${RESET}"
  curl -LsSf https://astral.sh/uv/install.sh | sh 2>/dev/null || { echo -e "  ${RED}✗ Failed to install uv. Install manually: https://docs.astral.sh/uv/${RESET}"; }
fi

# ── 2. Build code-review-graph ────────────────────────────────────────────────
echo -e "\n${BOLD}[2/5] code-review-graph${RESET}"

if command -v uvx >/dev/null 2>&1 || command -v code-review-graph >/dev/null 2>&1; then
  echo -e "  Building full graph..."
  uvx code-review-graph build --full --repo "$ROOT" 2>/dev/null || code-review-graph build --full --repo "$ROOT" 2>/dev/null || echo -e "  ${YELLOW}⚠ CRG build failed — will retry on first commit${RESET}"

  if [ -d "$ROOT/.code-review-graph" ]; then
    NODES=$(uvx code-review-graph status --repo "$ROOT" 2>/dev/null | grep "Nodes:" | head -1 || echo "unknown")
    echo -e "  ${GREEN}✓${RESET} Graph built ($NODES)"
  fi
else
  echo -e "  ${YELLOW}⚠ Skipped — uvx not available${RESET}"
fi

# ── 3. Build graphify ─────────────────────────────────────────────────────────
echo -e "\n${BOLD}[3/5] graphify${RESET}"

if [ "$SKIP_GRAPHIFY" = true ]; then
  echo -e "  ${YELLOW}Skipped (--skip-graphify)${RESET}"
elif command -v graphify >/dev/null 2>&1; then
  echo -e "  Building knowledge graph..."
  graphify build 2>/dev/null || echo -e "  ${YELLOW}⚠ graphify build failed${RESET}"
  [ -f "$ROOT/graphify-out/graph.json" ] && echo -e "  ${GREEN}✓${RESET} graphify-out/graph.json exists" || echo -e "  ${YELLOW}⚠ graph.json not found${RESET}"
else
  echo -e "  ${YELLOW}⚠ graphify CLI not found — install via pip or skip${RESET}"
fi

# ── 4. Generate AI IDE configs ────────────────────────────────────────────────
echo -e "\n${BOLD}[4/5] AI IDE configs${RESET}"

if [ -x "$ROOT/scripts/gen-ai-config.sh" ]; then
  bash "$ROOT/scripts/gen-ai-config.sh"
else
  echo -e "  ${YELLOW}⚠ gen-ai-config.sh not found or not executable${RESET}"
fi

# ── 5. Verify ─────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[5/5] Verify${RESET}"

[ -d "$ROOT/.code-review-graph" ] && echo -e "  ${GREEN}✓${RESET} .code-review-graph/" || echo -e "  ${YELLOW}⚠${RESET} .code-review-graph/ missing"
[ -f "$ROOT/.mcp.json" ] && echo -e "  ${GREEN}✓${RESET} .mcp.json" || echo -e "  ${RED}✗${RESET} .mcp.json missing"
[ -f "$ROOT/CLAUDE.md" ] && echo -e "  ${GREEN}✓${RESET} CLAUDE.md" || echo -e "  ${RED}✗${RESET} CLAUDE.md missing"
[ -f "$ROOT/.cursorrules" ] && echo -e "  ${GREEN}✓${RESET} .cursorrules" || echo -e "  ${RED}✗${RESET} .cursorrules missing"
[ -d "$ROOT/.ai-metrics" ] && echo -e "  ${GREEN}✓${RESET} .ai-metrics/" || mkdir -p "$ROOT/.ai-metrics" && echo -e "  ${GREEN}✓${RESET} .ai-metrics/ (created)"

echo -e "\n${BOLD}━━━ Setup complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Each team member runs this once after cloning."
echo -e "  Graphs auto-update on every commit via .husky/post-commit."
echo -e "  After git pull, run: ${GREEN}./scripts/sync-ai.sh${RESET}\n"
