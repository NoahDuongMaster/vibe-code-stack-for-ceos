---
inclusion: always
---

# Architecture Rules

## Folder Purpose (quick reference)
```
src/
  app/             Routes ONLY — pages, layouts, API route handlers. Zero business logic.
  features/        Vertical slices. One folder per business domain.
    [name]/
      _components/ Private UI — ONLY this feature imports it (prefix _ = not exported)
      _hooks/      Private hooks — ONLY this feature imports it
      adapters/    HTTP functions for this domain (calls shared/lib/xhr)
      schemas/     Zod schemas + derived types
      services/    Business logic — orchestrates adapters
      actions/     next-safe-action server actions
      index.ts     ★ PUBLIC barrel — only this is importable outside the feature
  shared/          Cross-cutting utilities. Zero business logic. Safe to import from anywhere.
    components/
      providers/   App-level React providers
      ui/          Headless Ark UI primitive wrappers
    config/        Env vars (T3 pattern). Client-safe — NEXT_PUBLIC_ vars only.
    constants/     App-wide constants: routes, SEO
    hooks/         Generic reusable hooks (no business logic)
    lib/           Core infrastructure: xhr.ts, base.service.ts
    stores/        Global Zustand stores + React Query provider
    types/         Global TypeScript types
    utils/         Pure utility functions. No side effects. No API calls.
  server/          Server-only code. NEVER import in Client Components.
    lib/           session.ts (iron-session) — has 'import server-only'
```

## Layering (strict — never skip or reverse)
```
app/page.tsx  or  features/[name]/_components/
    ↓ imports from
features/[name]/index.ts  ← public barrel only
    ↓ internally uses
features/[name]/services/
    ↓ calls
features/[name]/adapters/
    ↓ HTTP via shared/lib/xhr
External API
```

## Dependency Direction (Clean Architecture)
```
app/  →  features/[name]/index.ts  →  shared/
                                       ↑
                     server/lib/  ─────┘
```

## Hard Rules
- `app/` imports from `features/[name]/index.ts` ONLY — never deep into feature internals
- `features/` imports from `shared/` but NEVER from other features directly
- `features/[name]/_components/` and `_hooks/` are private — only importable within that feature
- `shared/` NEVER imports from `features/` or `app/`
- `server/lib/` is server-only — NEVER import in Client Components or shared/
- Feature adapters call `shared/lib/xhr.ts` — never use `fetch()` directly

## Server Component vs Client Component

**Server Component** (default — no directive):
- Fetches data with async/await
- Reads env vars, cookies, headers
- Renders static markup, no interactivity

**Client Component** (add `'use client'` at top):
- Uses useState, useEffect, useRef, useCallback
- Accesses window, localStorage, document
- Has onClick, onChange, onSubmit handlers
- Uses TanStack Query hooks (useQuery, useMutation)

**Hard rules:**
- NEVER `'use client'` on layout.tsx
- Push `'use client'` as deep in tree as possible
- Client Components can be children of Server Components
- Server Components CANNOT be imported into Client Components

## Route Groups
```
app/
  (web3)/layout.tsx   ← Solana/blockchain — isolated bundle
  layout.tsx          ← Root: only global providers (QueryClient, theme)
```
