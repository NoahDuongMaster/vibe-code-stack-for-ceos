# AI-First Next.js Boilerplate — Project Guide

> **For all AI assistants**: This file is the single source of truth for coding in this project.
> Rules here apply regardless of which AI tool you are (Claude, Cursor, Copilot, DeepSeek, Gemini, Windsurf).
> When in doubt about a pattern, read `src/__examples__/` — those are canonical implementations.

---

## Tech Stack

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| Framework | Next.js App Router | ^15.3 | Server Components by default |
| Language | TypeScript | ^5.8 | strict: true enforced |
| Styling | Tailwind CSS v4 + Ark UI | ^4.1 | OKLCH colors, CSS-first config; use @ark-ui/react for headless primitives |
| Auth | iron-session | ^8.0 | stateless encrypted cookie sessions; see src/server/lib/session.ts |
| Server State | TanStack Query | ^5.80 | for all async/API data |
| Client State | Zustand | ^5.0 | for UI state only |
| URL State | nuqs | ^2.4 | for filters/pagination/search params |
| Forms | react-hook-form + Zod v4 | — | never useState for forms |
| Server Actions | next-safe-action | ^7.9 | type-safe server actions |
| Tables | TanStack Table | ^8.21 | for all data tables |
| HTTP | ofetch → shared/lib/xhr.ts | ^1.4 | universal (browser/edge/SSR), never fetch() directly |
| Animations | motion (framer-motion v12) | ^12 | tree-shakeable, import from 'motion/react' |
| Analytics | @vercel/analytics + speed-insights | ^1 | auto-included in layout.tsx |
| Linting | ESLint + Biome | — | ESLint for Next.js rules, Biome for format+lint |
| Testing | Vitest + Testing Library | ^3.2 | mock adapters, not services |
| Validation | Zod | ^4.0 | schemas in *.schema.ts files |

---

## Folder Map — Where Does New Code Go?

```
src/
  __examples__/    REFERENCE ONLY. Read before writing new code.
  app/             Next.js routing ONLY — pages, layouts, API routes. No business logic.
    (web3)/        Isolated Web3/Solana routes.
    api/           Thin route handlers — delegate to features/ or server/

  features/        ★ Vertical feature slices. One folder per business domain.
    [name]/
      _components/ Private UI — only this feature uses it (prefix _ = not exported)
      _hooks/      Private hooks — only this feature uses it
      adapters/    HTTP calls for this domain (calls shared/lib/xhr)
      schemas/     Zod schemas + derived types
      services/    Business logic — orchestrates adapters
      actions/     next-safe-action server actions
      types.ts     Feature-scoped TypeScript types
      index.ts     ★ Public barrel export — information hiding boundary

  shared/          Cross-cutting, zero business logic. Safe to import from anywhere.
    components/
      providers/   App-level providers (Devtools, WebVitals, etc.)
      ui/          Headless primitive wrappers (Ark UI)
    config/        Env vars (T3 OSS). Client-safe — NEXT_PUBLIC_ vars accessible here.
    constants/     App-wide constants: routes, SEO.
    hooks/         Generic reusable hooks (no business logic).
    lib/           Core infrastructure: xhr.ts, base.service.ts
    stores/        Global Zustand stores + React Query provider.
    types/         Global TypeScript types. File: [domain].types.ts
    utils/         Pure utility functions. No side effects. No API calls.

  server/          Server-only code. NEVER import from client components.
    lib/           session.ts (iron-session) — has 'import server-only'

  styles/          Global CSS only.
```

---

## Decision Tree 1 — Where to put new code?

```
New page or route?
  → src/app/[route]/page.tsx  (Server Component by default)

New API endpoint?
  → src/app/api/[name]/route.ts

New business UI component (belongs to a feature)?
  → src/features/[feature]/_components/[name].tsx

New HTTP API call to external service?
  → src/features/[feature]/adapters/[feature].adapter.ts
  → called only from src/features/[feature]/services/

New business logic / data orchestration?
  → src/features/[feature]/services/[feature].service.ts

New feature-specific Zod schema + types?
  → src/features/[feature]/schemas/[feature].schema.ts

New server action (next-safe-action)?
  → src/features/[feature]/actions/[feature].action.ts

New feature public exports (what other features/pages can use)?
  → src/features/[feature]/index.ts  ← barrel export only

New shared global UI state (crosses feature boundaries)?
  → src/shared/stores/[name].store.tsx  (Zustand)

New generic reusable hook (no business logic)?
  → src/shared/hooks/use-[name].ts

New app-wide constant?
  → src/shared/constants/[name].constant.ts

New global TypeScript type/interface?
  → src/shared/types/[domain].types.ts

New environment variable?
  → src/shared/config/env.configuration.ts  (NEXT_PUBLIC_* vars)
  → access via: import { env } from '@/shared/config/env.configuration'

New server-only utility?
  → src/server/lib/[name].ts
```

---

## Decision Tree 2 — Server Component or Client Component?

```
Does the component use useState, useEffect, useRef, or any React hook?
  YES → add 'use client' at the top
  NO  → Server Component (no directive needed)

Does it access browser-only APIs (window, document, localStorage)?
  YES → 'use client'
  NO  → Server Component

Does it use TanStack Query hooks (useQuery, useMutation, useSuspenseQuery)?
  YES → 'use client'
  NO  → Server Component (use async/await directly)

Does it have onClick, onChange, or any event handler on an HTML element?
  YES → 'use client'
  NO  → Server Component

HARD RULES:
  ✗ NEVER add 'use client' to layout.tsx files
  ✗ NEVER add 'use client' to page.tsx unless that page is entirely client-side
  ✓ Push 'use client' as deep in the component tree as possible
  ✓ Server Components can import and render Client Components
  ✗ Client Components CANNOT import Server Components
```

---

## Decision Tree 3 — Which state management?

```
Data fetched from an API (async, server-owned)?
  → TanStack Query — useQuery() / useSuspenseQuery() / useMutation()

UI state shared across multiple routes or distant components?
  → Zustand store in src/shared/stores/

Form field values and validation state?
  → react-hook-form — NEVER useState for form fields

Local component state (visible only to this component)?
  → useState — fine for simple local UI toggles

State derived from URL (filters, pagination, search)?
  → nuqs — useQueryState() / useQueryStates() from 'nuqs'
  → useSearchParams() only for simple read-only cases

Server state with optimistic updates?
  → TanStack Query useMutation + onMutate callback

Mutating server data via Server Action (type-safe)?
  → next-safe-action — define with createSafeActionClient(), call with useAction()
```

---

## Naming Conventions

| Thing | Convention | Example |
|-------|------------|---------|
| Component file | kebab-case | `user-profile.tsx` |
| Hook file | `use-` prefix, kebab-case | `use-user-profile.ts` |
| Service file | `.service.ts` suffix | `user.service.ts` |
| Adapter file | `.adapter.ts` suffix | `user.adapter.ts` |
| Schema file | `.schema.ts` suffix | `user.schema.ts` |
| Store file | `.store.tsx` suffix | `user.store.tsx` |
| Type file | `.types.ts` suffix | `user.types.ts` |
| Constant file | `.constant.ts` suffix | `user.constant.ts` |
| Component (export) | PascalCase | `export function UserProfile()` |
| Hook (export) | camelCase + `use` prefix | `export function useUserProfile()` |
| Zod schema | `Z` prefix, PascalCase | `const ZUser = z.object(...)` |
| Derived type | `T` prefix, PascalCase | `type TUser = z.infer<typeof ZUser>` |
| Constant value | SCREAMING_SNAKE_CASE | `API_ROUTES.GET_USER` |
| Zustand hook | `use` + PascalCase + `Store` | `useUserStore` |

---

## Architecture Layering (STRICT — never skip)

```
app/ (page.tsx / route.ts)
    ↓ imports
features/[name]/index.ts  (public feature API — barrel export)
    ↓ internally uses
features/[name]/services/  →  features/[name]/adapters/  →  External API
```

**Dependency rule (Clean Architecture):**
```
app/          →  features/  →  shared/
                              ↑
              server/lib/  ──┘
```

**RULE**: `app/` imports from `features/[name]/index.ts` only — never deep into feature internals.
**RULE**: `features/` imports from `shared/` but NEVER from other features directly.
**RULE**: `features/[name]/_components/` are private — only importable within that feature.
**RULE**: `shared/` never imports from `features/` or `app/`.
**RULE**: `server/lib/` is server-only — never import in Client Components.
**RULE**: Feature adapters call `shared/lib/xhr.ts`. Never use `fetch()` directly.

---

## Code Patterns — Use These Exactly

### Pattern: Zod Schema + Type
```typescript
// src/features/user/schemas/user.schema.ts
import { z } from 'zod'

export const ZUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
})

export const ZGetUserQuery = z.object({
  id: z.string().uuid(),
})

export type TUser = z.infer<typeof ZUser>
export type TGetUserQuery = z.infer<typeof ZGetUserQuery>
```

### Pattern: Adapter
```typescript
// src/features/user/adapters/user.adapter.ts
import { Request } from '@/shared/lib/xhr'
import { API_ROUTES } from '@/shared/constants/routes.constant'
import type { TUser, TGetUserQuery } from '../schemas/user.schema'

const request = new Request()

export const getUserAPI = async (query: TGetUserQuery): Promise<TUser> =>
  request.get<TUser>(API_ROUTES.GET_USER, query)

export const createUserAPI = async (data: Omit<TUser, 'id' | 'createdAt'>): Promise<TUser> =>
  request.post<typeof data, TUser>(API_ROUTES.CREATE_USER, data)
```

### Pattern: Service
```typescript
// src/features/user/services/user.service.ts
import { getUserAPI, createUserAPI } from '../adapters/user.adapter'
import type { TUser } from '../schemas/user.schema'

export const userService = {
  async getUser(id: string): Promise<TUser> {
    return getUserAPI({ id })
  },

  async createUser(data: Omit<TUser, 'id' | 'createdAt'>): Promise<TUser> {
    return createUserAPI(data)
  },
}
```

### Pattern: Feature barrel export
```typescript
// src/features/user/index.ts  ← only export what app/ needs
export { userService } from './services/user.service'
export type { TUser } from './schemas/user.schema'
```

### Pattern: Server Component with data
```typescript
// src/app/users/page.tsx
import { userService } from '@/features/user'
import { Suspense } from 'react'
import { UserList } from '@/features/user/_components/user-list'

async function UserData() {
  const users = await userService.getUsers()
  return <UserList users={users} />
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-md bg-muted" />}>
      <UserData />
    </Suspense>
  )
}
```

### Pattern: Client Component with TanStack Query
```typescript
// src/features/user/_components/user-list.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { userService } from '../services/user.service'

export function UserList() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getUsers(),
  })

  if (isLoading) return <div>Loading...</div>
  return <ul>{data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}
```

### Pattern: Form with react-hook-form + Zod
```typescript
// src/features/user/_components/create-user-form.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const FormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
})
type FormValues = z.infer<typeof FormSchema>

export function CreateUserForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: '', name: '' },
  })

  async function onSubmit(values: FormValues) {
    await userService.createUser(values)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <button type="submit" disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium h-10 px-4 hover:bg-primary/90 transition-colors disabled:opacity-50">
        {isSubmitting ? 'Creating...' : 'Create User'}
      </button>
    </form>
  )
}
```

### Pattern: Zustand Store (global, cross-feature)
```typescript
// src/shared/stores/ui.store.tsx
'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UIState = {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'ui-state' }
  )
)
```

---

## Anti-patterns — NEVER Do These

```
❌ fetch() or axios inside a component
   ✓ Use TanStack Query hook or move data fetching to Server Component

❌ 'use client' on layout.tsx
   ✓ Only add to components/pages that actually need client interactivity

❌ useState to manage form field values
   ✓ Use react-hook-form for all forms

❌ console.log() in source files
   ✓ Use logger.info() / logger.error() from @/shared/utils/logger.helper (consola)

❌ Hardcoded URLs: fetch('https://api.example.com/users')
   ✓ Always use API_ROUTES from @/shared/constants/routes.constant

❌ Hardcoded web routes: router.push('/sign-in')
   ✓ Always use WEB_ROUTES from @/shared/constants/routes.constant

❌ import from features/[name]/adapters/ or features/[name]/services/ directly
   ✓ Import only from features/[name]/index.ts (the public barrel)

❌ Cross-feature imports: features/auth importing from features/user
   ✓ Extract shared logic to shared/ if two features need it

❌ import from server/lib/ in a Client Component
   ✓ server/lib/ is server-only; call via API route or Server Component

❌ type: any  or  as any
   ✓ Use unknown and narrow with type guards, or define proper types

❌ Business logic (calculations, data transforms) in page.tsx
   ✓ Move to src/features/[name]/services/

❌ New env var: process.env.MY_VAR directly
   ✓ Declare in src/shared/config/env.configuration.ts, then import env

❌ Large useEffect with 3+ dependencies
   ✓ Extract into a named custom hook in src/features/[name]/_hooks/ or src/shared/hooks/

❌ Default export for components (except pages)
   ✓ Named exports: export function UserCard() {}
   ✓ Default export only for: page.tsx, layout.tsx, not-found.tsx

❌ Inline styles: style={{ color: 'red' }}
   ✓ Use Tailwind classes only. For dynamic: cn() helper from @/shared/utils/tailwind.helper
```

---

## Import Order (enforced by ESLint)

```typescript
// 1. React and Next.js
import { Suspense, useState } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

// 2. External packages
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { create } from 'zustand'

// 3. Internal — @/ path alias (grouped by layer: shared → features → server)
import { cn } from '@/shared/utils/tailwind.helper'
import { API_ROUTES } from '@/shared/constants/routes.constant'
import type { TUser } from '@/shared/types'
import { userService } from '@/features/user'
```

---

## Testing Conventions

- Test files mirror source: `src/__test__/features/user/user.service.test.ts`
- Mock feature adapters (HTTP layer), never mock services
- Mock HTTP at network layer with MSW (src/__test__/mocks/), never mock service modules directly
- Test behavior, not implementation details
- Use `@testing-library/react` for component tests
- When mocking config/constants, use the new shared/ paths

```typescript
// src/__test__/features/user/user.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userService } from '@/features/user/services/user.service'
import * as userAdapter from '@/features/user/adapters/user.adapter'

vi.mock('@/features/user/adapters/user.adapter')
// Always mock shared deps at their new paths:
vi.mock('@/shared/config/env.configuration', () => ({
  env: { client: { NEXT_PUBLIC_API_ENDPOINT: 'http://localhost:3000' } },
}))

describe('userService.getUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user data from adapter', async () => {
    const mockUser = { id: '1', email: 'a@b.com', name: 'Alice', createdAt: '2024-01-01T00:00:00Z' }
    vi.mocked(userAdapter.getUserAPI).mockResolvedValue(mockUser)

    const result = await userService.getUser('1')
    expect(result).toEqual(mockUser)
    expect(userAdapter.getUserAPI).toHaveBeenCalledWith({ id: '1' })
  })
})
```

---

## Quality Gates (automated — run on every commit)

1. **ESLint** — architectural violations, no-console, no-unused-vars
2. **TypeScript** — `tsc --noEmit` — zero type errors allowed
3. **Vitest** — unit tests pass
4. **Commit message** format: `type(scope): description`
   - Types: `feat` `fix` `refactor` `docs` `test` `chore` `perf` `style`

---

## MCP Tools (for Claude Code / Kiro / tools with MCP support)

This project has a knowledge graph. Use before grepping:

| Tool | When to use |
|------|------------|
| `semantic_search_nodes` | Find function/component by name |
| `get_impact_radius` | Check blast radius before refactoring |
| `detect_changes` | Review staged changes with risk score |
| `query_graph pattern="callers_of"` | Find all callers of a function |
| `query_graph pattern="imports_of"` | Trace import dependencies |
| `get_architecture_overview` | Understand community structure |

---

## Canonical Examples

Read `src/__examples__/` before creating any new feature:

| Folder | When to reference |
|--------|------------------|
| `_server-data/` | Server Component + async data fetching + Suspense |
| `_client-state/` | Client Component + Zustand + event handlers |
| `_form/` | react-hook-form + Zod schema + submission |
| `_full-feature/` | Complete: schema → adapter → service → page → component |
