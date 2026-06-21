# AUTO-GENERATED from .ai/rules.md — do NOT edit directly.
# Run: ./scripts/gen-ai-config.sh

# AI-First Next.js Boilerplate — Project Rules

> **Single source of truth** for all AI assistants (Claude, Cursor, Copilot, Kiro, Qoder, Gemini, Windsurf).
> Run `./scripts/gen-ai-config.sh` after editing to sync all IDE configs.

---

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Next.js App Router | ^16.2 |
| Language | TypeScript | ^6.0 (strict: true) |
| Styling | Panda CSS + Ark UI | ^1.11 |
| Auth | iron-session | ^8.0 |
| Server State | TanStack Query | ^5.101 |
| Client State | Zustand | ^5.0 |
| URL State | nuqs | ^2.8 |
| Forms | react-hook-form + Zod v4 | — |
| Server Actions | next-safe-action | ^8.5 |
| Tables | TanStack Table | ^8.21 |
| HTTP | ofetch → shared/lib/xhr.ts | ^1.5 |
| Animations | motion (framer-motion v12) | ^12 |
| Linting | ESLint + Biome | — |
| Testing | Vitest + Testing Library | ^4.1 |

---

## Folder Structure

```
src/
  app/             Routes ONLY — pages, layouts, API route handlers. Zero business logic.
  features/        ★ Vertical slices. One folder per business domain.
    [name]/
      _components/ Private UI (prefix _ = NOT exported outside feature)
      _hooks/      Private hooks (prefix _ = NOT exported outside feature)
      adapters/    HTTP functions (calls shared/lib/xhr)
      schemas/     Zod schemas + derived types
      services/    Business logic — orchestrates adapters
      actions/     next-safe-action server actions
      index.ts     ★ PUBLIC barrel — the ONLY thing importable from outside
  shared/          Cross-cutting utilities. Zero business logic.
    components/ui/ Headless Ark UI primitive wrappers
    config/        Env vars (NEXT_PUBLIC_ only). Client-safe.
    constants/     App-wide constants: routes, SEO
    hooks/         Generic reusable hooks
    lib/           Core infrastructure: xhr.ts, base.service.ts
    stores/        Global Zustand stores + React Query provider
    types/         Global TypeScript types
    utils/         Pure utility functions
  server/          Server-only. NEVER import in Client Components.
    lib/           session.ts (iron-session, has 'import server-only')
```

---

## Architecture Rules (STRICT)

### Dependency Direction
```
app/  →  features/[name]/index.ts  →  shared/
                                       ↑
                     server/lib/  ─────┘
```

### Hard Rules
1. `app/` imports ONLY from `features/[name]/index.ts` — never deep into feature internals
2. `features/` imports from `shared/` but NEVER from other features
3. `features/[name]/_components/` and `_hooks/` are PRIVATE — only within that feature
4. `shared/` NEVER imports from `features/` or `app/`
5. `server/lib/` is server-only — NEVER in Client Components or `shared/`
6. Feature adapters call `shared/lib/xhr.ts` — never `fetch()` directly

### Server vs Client Component
```
'use client' ONLY when: useState, useEffect, useRef, onClick, useQuery, window/document
Default = Server Component (no directive)
NEVER 'use client' on layout.tsx
Push 'use client' as DEEP in tree as possible
```

---

## Naming Conventions

| Thing | Convention | Example |
|-------|------------|---------|
| Component file | kebab-case | `user-profile.tsx` |
| Component export | PascalCase | `export function UserProfile()` |
| Hook file | `use-` + kebab | `use-user-profile.ts` |
| Zod schema | `Z` prefix | `const ZUser = z.object(...)` |
| Derived type | `T` prefix | `type TUser = z.infer<typeof ZUser>` |
| Constant | SCREAMING_SNAKE | `API_ROUTES.GET_USER` |
| Zustand | `use` + Name + `Store` | `useUserStore` |
| Service | camelCase + `Service` | `userService` |
| Default export | ONLY for page.tsx, layout.tsx, not-found.tsx | — |

---

## Error Handling

- Use `error.tsx` per route segment for UI error boundaries
- Services throw typed errors — never raw strings or untyped `throw new Error()`
- Adapters catch HTTP errors and map to domain-specific error types
- Server Actions return `{ success, data?, error? }` via next-safe-action — never throw
- NEVER swallow errors silently — log via `logger` then re-throw or return error state
- Use `notFound()` from `next/navigation` for 404 cases — never return null/empty UI

---

## Accessibility (WCAG 2.2 AA)

- All interactive elements must be keyboard-navigable (Tab, Enter, Escape)
- Images require meaningful `alt` text (or `alt=""` for decorative)
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`) — never `<div>` + onClick
- Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text (18px+)
- Ark UI components handle a11y — do NOT override `aria-*` props without reason
- Forms: every input needs a visible `<label>` or `aria-label`
- Focus management: modals trap focus, return focus on close

---

## Performance

- Use `next/dynamic` with `{ ssr: false }` for heavy below-the-fold components
- Images via `next/image` with explicit `width`/`height` — NEVER raw `<img>`
- Prefer Server Components for data fetching (zero client JS)
- Lazy-load routes with `React.lazy` / dynamic imports where appropriate
- Use `React.memo` only when React Profiler confirms re-render cost
- Avoid large barrel re-exports that break tree-shaking — export types separately with `export type`

---

## Security

- NEVER commit secrets, tokens, or API keys — use `env.configuration.ts`
- Validate ALL user input with Zod at API boundary (server actions, route handlers)
- Use `import 'server-only'` guard on server modules
- NEVER use `dangerouslySetInnerHTML` without DOMPurify sanitization
- Configure CSP headers in `next.config.ts`
- NEVER use `eval()`, `Function()`, or `new Function()`
- Sanitize URL params before database queries — prevent injection

---

## Anti-patterns (NEVER)

- ❌ `fetch()` or axios in component → ✓ TanStack Query + service
- ❌ `'use client'` on layout.tsx → ✓ Server Component always
- ❌ useState for form fields → ✓ react-hook-form
- ❌ console.log → ✓ logger from @/shared/utils/logger.helper
- ❌ Hardcoded URLs → ✓ API_ROUTES / WEB_ROUTES from @/shared/constants/routes.constant
- ❌ import from features/[name]/adapters/ directly in app/ → ✓ features/[name]/index.ts
- ❌ Cross-feature: features/auth importing features/user → ✓ extract to shared/
- ❌ `any` or `as any` → ✓ unknown + type guard
- ❌ process.env.X directly → ✓ env from @/shared/config/env.configuration
- ❌ Default export on non-page files → ✓ Named exports

---

## Code Patterns

### Schema + Type
```typescript
// src/features/user/schemas/user.schema.ts
import { z } from 'zod'
export const ZUser = z.object({ id: z.string().uuid(), name: z.string().min(1) })
export type TUser = z.infer<typeof ZUser>
```

### Adapter
```typescript
// src/features/user/adapters/user.adapter.ts
import { Request } from '@/shared/lib/xhr'
import { API_ROUTES } from '@/shared/constants/routes.constant'
import type { TUser } from '../schemas/user.schema'
const request = new Request()
export const getUserAPI = async (id: string): Promise<TUser> =>
  request.get<TUser>(API_ROUTES.GET_USER, { id })
```

### Service
```typescript
// src/features/user/services/user.service.ts
import { getUserAPI } from '../adapters/user.adapter'
export const userService = { async getUser(id: string) { return getUserAPI(id) } }
```

### Barrel Export
```typescript
// src/features/user/index.ts
export { userService } from './services/user.service'
export type { TUser } from './schemas/user.schema'
```

### Import Order
```typescript
// 1. React / Next.js
// 2. External packages
// 3. @/shared/*
// 4. @/features/*
// 5. @/server/*
// 6. Relative imports (./sibling, ../parent)
// 7. Style imports
// 8. Type-only imports (import type — always last)
```

---

## MCP Tools (for AI assistants)

### code-review-graph — ALWAYS use BEFORE reading raw files
| Tool | When |
|------|------|
| `semantic_search_nodes` | Find function/component by name |
| `get_impact_radius` | Check blast radius before refactoring |
| `detect_changes` | Review staged changes with risk score |
| `query_graph pattern="callers_of"` | Find all callers |
| `get_architecture_overview` | Understand community structure |

### Context7 — use for current library docs
| Tool | When |
|------|------|
| `resolve_library_id` | Find library ID for docs lookup |
| `get_library_docs` | Fetch current docs (not stale training data) |

---

## Git Conventions

### Commit Message
```
type(scope): ISSUE-123 short description
```
- **Types**: `feat|fix|hotfix|docs|style|refactor|perf|test|build|ci|chore|BREAKING_CHANGE`
- **Scopes**: `dapp|admin|infra|backend|admin-backend|proxy|snapshot|tma|serverless`
- **Issue**: `issue-123` or `no-issue` for trivial changes
- Example: `feat(dapp): issue-42 add user profile page`

### Branch Naming
```
type(scope)/ISSUE-123-short-description
```
- Example: `feat(dapp)/issue-42-user-profile`

### PR
- Title follows commit convention
- Description includes: Summary, Test plan, Breaking changes (if any)

---

## Testing

### Structure
- Unit tests: `src/__test__/features/[name]/[name].service.test.ts`
- E2E tests: Playwright — `tests/[feature].spec.ts`

### Rules
- Mock adapters (HTTP layer), NEVER mock services
- `vi.mock('@/features/[name]/adapters/[name].adapter')`
- `vi.mock('@/shared/config/env.configuration', () => ({ env: { ... } }))`
- Test naming: `describe('[ServiceName]') > it('should [behavior] when [condition]')`
- Coverage target: ≥ 80% for services and adapters
- E2E: test critical user flows — login, CRUD, navigation
- NEVER test implementation details — test behavior and outcomes
