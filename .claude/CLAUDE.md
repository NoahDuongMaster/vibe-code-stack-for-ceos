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
