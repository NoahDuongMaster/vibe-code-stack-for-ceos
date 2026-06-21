#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# gen-ai-config.sh — Generate ALL AI IDE configs from single source (.ai/)
#
# Scientific basis:
#   - DRY Principle (Hunt & Thomas, 1999, "The Pragmatic Programmer")
#   - Single Source of Truth — reduces sync errors across distributed configs
#   - Context rot (Anthropic Eng Blog, June 2026) — consistent rules = consistent AI output
#
# Sources:
#   .ai/rules.md   → All AI instructions (architecture, patterns, anti-patterns)
#   .ai/mcp.json   → MCP server definitions (pinned versions)
#
# Targets (7 IDEs + hooks):
#   Claude Code    → CLAUDE.md, .claude/CLAUDE.md, .claude/steering/, .mcp.json
#   Cursor         → .cursorrules, .cursor/mcp.json
#   Kiro           → .kiro/steering/, .kiro/settings/mcp.json
#   Qoder          → .qoder/mcp.json
#   GitHub Copilot → .github/copilot-instructions.md
#   Windsurf       → .windsurfrules
#   Gemini         → .gemini/GEMINI.md
#   Pre-commit     → .husky/pre-commit (architecture rules extracted from rules.md)
#
# Usage:
#   ./scripts/gen-ai-config.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
AI_DIR="$ROOT/.ai"
RULES="$AI_DIR/rules.md"
MCP_SOURCE="$AI_DIR/mcp.json"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'

if [ ! -f "$RULES" ]; then
  echo -e "${RED}ERROR: $RULES not found${RESET}"
  exit 1
fi

GENERATED_HEADER="# AUTO-GENERATED from .ai/rules.md — do NOT edit directly.
# Run: ./scripts/gen-ai-config.sh"

echo -e "${BOLD}━━━ Generating AI configs from .ai/ ━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Source: .ai/rules.md ($(wc -l < "$RULES" | tr -d ' ') lines) + .ai/mcp.json"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. MCP configs (4 IDEs that support MCP)
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[1/7] MCP configs${RESET}"

for target in ".mcp.json" ".cursor/mcp.json" ".kiro/settings/mcp.json" ".qoder/mcp.json"; do
  mkdir -p "$ROOT/$(dirname "$target")"
  cp "$MCP_SOURCE" "$ROOT/$target"
  echo -e "  ${GREEN}✓${RESET} $target"
done

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Claude Code (CLAUDE.md + .claude/CLAUDE.md + steering)
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[2/7] Claude Code${RESET}"

# Root CLAUDE.md
printf '%s\n\n%s\n' "$GENERATED_HEADER" "$(cat "$RULES")" > "$ROOT/CLAUDE.md"
echo -e "  ${GREEN}✓${RESET} CLAUDE.md"

# .claude/CLAUDE.md — skill triggers (Claude-specific, source is in .ai/triggers.md or inline)
# These are Claude-only; other IDEs don't have skill triggers
cat > "$ROOT/.claude/CLAUDE.md" << 'EOF'
# AUTO-GENERATED — skill triggers. Do NOT edit directly.
# Run: ./scripts/gen-ai-config.sh

# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

# fresh-docs
- **fresh-docs** (`.claude/skills/fresh-docs/skill.md`) - fetch live library docs via Context7 to avoid stale AI knowledge. Trigger: `/fresh-docs`
When the user types `/fresh-docs`, or asks about the current API of any library in the stack (Next.js, TanStack Query, Zod, Ark UI, etc.), invoke the Skill tool with `skill: "fresh-docs"` before answering from memory.

# new-feature
- **new-feature** (`.claude/skills/new-feature/skill.md`) - scaffold a complete vertical feature slice. Trigger: `/new-feature`
When the user types `/new-feature`, invoke the Skill tool with `skill: "new-feature"` before doing anything else.

# review-changes
- **review-changes** (`.claude/skills/review-changes/skill.md`) - graph-powered code review with risk scoring. Trigger: `/review-changes`
When the user types `/review-changes`, invoke the Skill tool with `skill: "review-changes"` before doing anything else.

# debug-issue
- **debug-issue** (`.claude/skills/debug-issue/skill.md`) - systematic graph-powered debugging. Trigger: `/debug-issue`
When the user types `/debug-issue`, invoke the Skill tool with `skill: "debug-issue"` before doing anything else.

# refactor-safely
- **refactor-safely** (`.claude/skills/refactor-safely/skill.md`) - safe refactoring with dependency analysis. Trigger: `/refactor-safely`
When the user types `/refactor-safely`, invoke the Skill tool with `skill: "refactor-safely"` before doing anything else.

# explore-codebase
- **explore-codebase** (`.claude/skills/explore-codebase/skill.md`) - navigate and understand codebase structure. Trigger: `/explore-codebase`
When the user types `/explore-codebase`, invoke the Skill tool with `skill: "explore-codebase"` before doing anything else.
EOF
echo -e "  ${GREEN}✓${RESET} .claude/CLAUDE.md (triggers)"

# Consolidated steering
STEERING_DIR="$ROOT/.claude/steering"
mkdir -p "$STEERING_DIR"
printf -- '---\ninclusion: always\n---\n%s\n\n%s\n' "$GENERATED_HEADER" "$(cat "$RULES")" > "$STEERING_DIR/rules.md"
echo -e "  ${GREEN}✓${RESET} .claude/steering/rules.md"

for old in architecture.md conventions.md do-not.md patterns.md stack-versions.md; do
  [ -f "$STEERING_DIR/$old" ] && rm "$STEERING_DIR/$old" && echo -e "  ${YELLOW}⌫${RESET} .claude/steering/$old (merged)"
done

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Cursor
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[3/7] Cursor${RESET}"

printf '%s\n\n%s\n' "$GENERATED_HEADER" "$(cat "$RULES")" > "$ROOT/.cursorrules"
echo -e "  ${GREEN}✓${RESET} .cursorrules"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Kiro
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[4/7] Kiro${RESET}"

KIRO_DIR="$ROOT/.kiro/steering"
mkdir -p "$KIRO_DIR"

printf -- '---\ninclusion: always\n---\n%s\n\n%s\n' "$GENERATED_HEADER" "$(cat "$RULES")" > "$KIRO_DIR/rules.md"
echo -e "  ${GREEN}✓${RESET} .kiro/steering/rules.md"

cat > "$KIRO_DIR/code-review-graph.md" << 'EOF'
---
inclusion: always
---
# code-review-graph MCP — ALWAYS use BEFORE reading raw files
# AUTO-GENERATED — do NOT edit directly.

**Rule: use graph tools BEFORE Grep/Glob/Read.**

- `semantic_search_nodes` → find function/component
- `get_impact_radius` → blast radius before refactor
- `detect_changes` → review staged changes
- `query_graph pattern="callers_of"` → trace dependencies
- `get_architecture_overview` → community structure
EOF
echo -e "  ${GREEN}✓${RESET} .kiro/steering/code-review-graph.md"

for old in architecture.md conventions.md do-not.md patterns.md; do
  [ -f "$KIRO_DIR/$old" ] && rm "$KIRO_DIR/$old" && echo -e "  ${YELLOW}⌫${RESET} .kiro/steering/$old (merged)"
done

# ═══════════════════════════════════════════════════════════════════════════════
# 5. GitHub Copilot
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[5/7] GitHub Copilot${RESET}"

mkdir -p "$ROOT/.github"
printf '%s\n\n%s\n' "$GENERATED_HEADER" "$(cat "$RULES")" > "$ROOT/.github/copilot-instructions.md"
echo -e "  ${GREEN}✓${RESET} .github/copilot-instructions.md"

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Windsurf
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[6/7] Windsurf${RESET}"

printf '%s\n\n%s\n' "$GENERATED_HEADER" "$(cat "$RULES")" > "$ROOT/.windsurfrules"
echo -e "  ${GREEN}✓${RESET} .windsurfrules"

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Gemini
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[7/7] Gemini${RESET}"

mkdir -p "$ROOT/.gemini"
printf '%s\n\n%s\n' "$GENERATED_HEADER" "$(cat "$RULES")" > "$ROOT/.gemini/GEMINI.md"
echo -e "  ${GREEN}✓${RESET} .gemini/GEMINI.md"

# ═══════════════════════════════════════════════════════════════════════════════
# Pre-commit: extract architecture rules from rules.md
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}[+] Pre-commit AI review${RESET}"

ARCH_RULES=$(python3 -c "
import re
with open('$RULES') as f:
    content = f.read()
match = re.search(r'### Hard Rules\n(.*?)(?=\n###|\n---|\n## )', content, re.DOTALL)
if match:
    rules = match.group(1).strip()
    lines = [l.strip() for l in rules.split('\n') if l.strip().startswith(('1.','2.','3.','4.','5.','6.'))]
    print('\n'.join(lines))
else:
    print('1. app/ imports ONLY from features/[name]/index.ts')
    print('2. features/_components/ and _hooks/ are PRIVATE')
    print('3. shared/ NEVER imports from features/ or app/')
    print('4. server/lib/ is server-only')
    print('5. No cross-feature imports')
    print('6. Adapters only called from their feature services')
")

cat > "$ROOT/.husky/pre-commit" << 'PRECOMMIT'
#!/bin/sh
npx lint-staged

# AI code review (pre-commit) via PR-Agent (open-source, Apache 2.0)
# Skip in CI or when SKIP_AI_REVIEW=1. Install: pip install pr-agent
if [ -z "$CI" ] && [ -z "$SKIP_AI_REVIEW" ] && command -v pr-agent >/dev/null 2>&1; then
  DIFF=$(git diff --staged)
  if [ -n "$DIFF" ]; then
    echo "$DIFF" | pr-agent review --local || \
      echo "[AI review] Pre-commit review skipped. Will run at PR level via GitHub Action."
  fi
fi
PRECOMMIT
chmod +x "$ROOT/.husky/pre-commit"
echo -e "  ${GREEN}✓${RESET} .husky/pre-commit"

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Source:       ${GREEN}.ai/rules.md${RESET} ($(wc -l < "$RULES" | tr -d ' ') lines) + ${GREEN}.ai/mcp.json${RESET}"
echo -e ""
echo -e "  Generated:"
echo -e "    Claude      CLAUDE.md, .claude/CLAUDE.md, .claude/steering/rules.md, .mcp.json"
echo -e "    Cursor      .cursorrules, .cursor/mcp.json"
echo -e "    Kiro        .kiro/steering/rules.md, .kiro/settings/mcp.json"
echo -e "    Qoder       .qoder/mcp.json"
echo -e "    Copilot     .github/copilot-instructions.md"
echo -e "    Windsurf    .windsurfrules"
echo -e "    Gemini      .gemini/GEMINI.md"
echo -e "    Hooks       .husky/pre-commit"
echo -e ""
echo -e "  ${YELLOW}Edit .ai/rules.md → run this script → all 7 IDEs sync.${RESET}"
echo -e ""
