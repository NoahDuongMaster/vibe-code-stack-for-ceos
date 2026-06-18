---
inclusion: always
---

# Architecture — AI-First Next.js Boilerplate

## Layering (strict — never skip or reverse)
```
app/page.tsx  or  components/features/
    ↓ calls
services/[domain].service.ts
    ↓ calls
adapters/[domain]/[domain].adapter.ts
    ↓ HTTP
External API
```

## Server vs Client Component

**Server Component** (default — no directive):
- async data fetching
- env vars, cookies, headers
- static/read-only rendering

**Client Component** (`'use client'` at top):
- useState, useEffect, useRef, useCallback
- window, localStorage, document
- onClick, onChange, onSubmit handlers
- TanStack Query hooks

**HARD RULES:**
- NEVER `'use client'` on layout.tsx
- Push `'use client'` as deep in tree as possible
- Server can render Client. Client CANNOT import Server.

## State Management Decision
```
API/async data?                → TanStack Query
Shared UI state across routes? → Zustand
Form state?                    → react-hook-form
Local UI toggle?               → useState
URL-derived?                   → useSearchParams
```

## Folder Responsibilities
```
adapters/   HTTP functions only. No logic. No imports from services/.
services/   Business logic + orchestration. Calls adapters.
components/
  common/   shadcn primitives. No business logic.
  features/ Business UI. Calls services. Composes common/.
app/        Route entry points. Minimal logic — delegate to services.
stores/     Zustand UI state + QueryClient provider.
types/      Shared TypeScript types only.
utils/    Pure utility functions. No API calls. No side effects.
```

## Route Groups
```
app/
  layout.tsx       Root — minimal providers (QueryClient, theme)
  (web3)/
    layout.tsx     Isolated — Solana/blockchain providers only here
  (auth)/
    layout.tsx     Auth-only pages (if added)
```
