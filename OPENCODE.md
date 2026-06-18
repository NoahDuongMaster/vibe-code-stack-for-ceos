# AI-First Next.js Boilerplate — OpenCode Guide

> Project guide for OpenCode AI. Same rules as CLAUDE.md — all AI tools use identical conventions.
> Read `src/__examples__/` before writing any new code.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 + Ark UI
TanStack Query v5 · Zustand v5 · react-hook-form + Zod v4
iron-session v8 · next-safe-action v8 · nuqs v2 · ofetch v1
Vitest v4 + MSW v2 · Playwright E2E · Biome v2

## Architecture (strict — never skip layers)

```
app/page.tsx              ← route entry, no business logic
    ↓
services/*.service.ts     ← business logic, data orchestration
    ↓
adapters/*.adapter.ts     ← raw HTTP calls, one function per endpoint
    ↓
External API
```

**RULE**: `components/features/` → `services/` → `adapters/` → API.
Never import adapters inside components.

## Where New Code Goes

| What | Where |
|------|-------|
| New page | `src/app/[route]/page.tsx` |
| New API route | `src/app/api/[name]/route.ts` |
| Business component | `src/components/features/[name].tsx` |
| HTTP function | `src/adapters/[domain]/[domain].adapter.ts` |
| Business logic | `src/services/[domain].service.ts` |
| Global UI state | `src/stores/[name].store.tsx` (Zustand) |
| Shared hook | `src/hooks/use-[name].ts` |
| Shared type | `src/types/[domain].types.ts` |
| App constant | `src/constants/[name].constant.ts` |

## Server vs Client Component

```
Uses useState / useEffect / useRef?          → 'use client'
Uses TanStack Query hooks?                    → 'use client'
Has onClick / onChange event handlers?        → 'use client'
Accesses window / document / localStorage?   → 'use client'
Otherwise?                                    → Server Component (no directive)
```

**NEVER** add `'use client'` to `layout.tsx` or `page.tsx` (unless fully client-side).

## State Management

| Data type | Tool |
|-----------|------|
| Async / server data | TanStack Query (`useQuery`, `useMutation`) |
| Shared UI state | Zustand store in `src/stores/` |
| Form fields | react-hook-form — NEVER useState for forms |
| URL params / filters | nuqs `useQueryState()` |
| Server mutations | next-safe-action `createSafeActionClient()` |

## Key Naming Conventions

| Thing | Pattern | Example |
|-------|---------|---------|
| Component file | kebab-case | `user-profile.tsx` |
| Zod schema | `Z` prefix | `const ZUser = z.object(...)` |
| Derived type | `T` prefix | `type TUser = z.infer<typeof ZUser>` |
| Constant | SCREAMING_SNAKE | `API_ROUTES.GET_USER` |
| Store hook | `use` + PascalCase + `Store` | `useUserStore` |

## Anti-patterns

```
❌ fetch() / axios inside components    → use TanStack Query or Server Component
❌ 'use client' on layout.tsx           → only add deep in the tree
❌ useState for form fields             → react-hook-form
❌ console.log()                        → consola logger from @/utils/logger.helper
❌ Hardcoded URLs                       → API_ROUTES / WEB_ROUTES from constants
❌ import adapter inside component      → always through services/
❌ type: any                            → use unknown + type guards
❌ process.env.MY_VAR directly          → src/config/env.configuration.ts
❌ Default exports (except pages)       → named exports everywhere
❌ Inline styles                        → Tailwind classes + cn() helper
```

## Code Review Graph (MCP)

This project has an always-updated knowledge graph. Use MCP tools before exploring raw files:

```
semantic_search_nodes   → find a function/component by name
get_impact_radius       → check blast radius before refactoring
detect_changes          → review staged changes with risk score
query_graph             → trace callers, imports, dependencies
get_architecture_overview → understand community structure
```

## Testing

- Unit tests: `src/__test__/[layer]/[name].test.ts`
- Mock adapters (HTTP layer), **never** mock services
- MSW handlers: `src/__test__/mocks/handlers.ts`
- E2E: `e2e/[feature].test.ts` using Playwright
- Run: `npm test` (unit) · `npm run test:e2e` (E2E)
