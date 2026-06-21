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
