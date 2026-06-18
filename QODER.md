# AI-First Next.js Boilerplate — Project Guide

> Rules here apply to ALL AI tools. Same conventions, same quality, regardless of which tool is used.
> Canonical patterns: `src/__examples__/` — read before writing new code.

## Stack
Next.js 15 App Router | React 19 | TypeScript strict | Tailwind + shadcn/ui
TanStack Query v5 | Zustand v5 | react-hook-form + Zod | ^4.0

## Folder Map
```
adapters/        HTTP calls only. Per domain. Called from services/ only.
services/        Business logic. Calls adapters. Called by pages/components.
components/
  common/        shadcn primitives. Zero business logic.
  features/      Business UI. Calls services.
app/             Routes. Minimal logic.
  (web3)/        Isolated blockchain routes.
stores/          Zustand (UI state) + QueryClient.
types/           Shared TypeScript types.
helpers/         Pure utilities.
__examples__/    REFERENCE ONLY — canonical patterns.
```

## Key Rules
- Default: Server Component. Add `'use client'` only for hooks/events/browser APIs.
- NEVER `'use client'` on layout.tsx.
- State: API data → TanStack Query | UI state → Zustand | Forms → react-hook-form.
- Naming: files kebab-case, components PascalCase, Zod | ^4.0
- Architecture: page → services → adapters. Components never import adapters directly.
- No `any` type. No `console.log` (use logger helper). No hardcoded URLs (use constants).

---

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
