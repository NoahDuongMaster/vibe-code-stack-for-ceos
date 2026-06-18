# Gemini Project Rules — AI-First Next.js Boilerplate

> Follow these rules for all code written in this project.
> Same rules apply regardless of which AI tool is used — consistency is the goal.
> Canonical examples are in `src/__examples__/` — read them before writing new code.

## Stack
- Next.js ^15.3.4 (App Router) + React 19 + TypeScript strict
- Tailwind CSS + shadcn/ui | TanStack Query v5 | Zustand v5
- react-hook-form + Zod | ^4.0

## Folder Map

```
adapters/        HTTP functions. One file per domain. No logic.
services/        Business logic. Calls adapters. Called by pages/components.
components/
  common/        shadcn primitives only. Zero business logic.
  features/      Business UI. Calls services.
app/             Pages and API routes. Minimal logic.
  (web3)/        Isolated blockchain routes.
stores/          Zustand (UI state) + ReactQuery provider.
types/           Shared TypeScript types.
helpers/         Pure utilities. No API calls.
hooks/           Shared React hooks.
constants/       Routes, SEO, static values.
configurations/  Env vars. Never access process.env directly.
__examples__/    REFERENCE ONLY — canonical patterns.
```

## Key Rules

### Server vs Client Component
- Default: Server Component (no directive)
- Add `'use client'`: useState, useEffect, event handlers, browser APIs, TanStack Query hooks
- NEVER `'use client'` on layout.tsx

### State Management
- API data → TanStack Query
- Shared UI state → Zustand
- Form state → react-hook-form (never useState)
- Local → useState

### Architecture (strict order)
`page → services → adapters → External API`
Components never call adapters directly.

### Naming
- Files: kebab-case (`user-profile.tsx`)
- Components: PascalCase named export
- Zod | ^4.0
- Types: T prefix (`TUser`)
- Stores: `useXxxStore`
- Default exports only for page.tsx / layout.tsx

## Anti-patterns
```
❌ fetch() in components          ✓ useQuery / Server Component
❌ 'use client' on layout.tsx     ✓ Never
❌ useState for forms             ✓ react-hook-form
❌ console.log()                  ✓ logger() from helpers/logger.helper
❌ Hardcoded URLs/routes          ✓ API_ROUTES / WEB_ROUTES constants
❌ adapters/ imported directly    ✓ Through services/ only
❌ any type                       ✓ Proper types or unknown
❌ process.env directly           ✓ env from configurations/env.configuration.ts
```

## Examples Reference
- `src/__examples__/_server-data/` — async Server Component
- `src/__examples__/_client-state/` — Zustand + client
- `src/__examples__/_form/` — react-hook-form + Zod | ^4.0
- `src/__examples__/_full-feature/` — complete feature pattern
