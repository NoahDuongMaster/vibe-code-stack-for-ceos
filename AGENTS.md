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
| Styling | Tailwind CSS v4 + Ark UI | ^4.1 | OKLCH colors, CSS-first; use @ark-ui/react for headless primitives |
| Server State | TanStack Query | v5 | for all async/API data |
| Client State | Zustand | v5 | for UI state only |
| Forms | react-hook-form + Zod | ^4.0 | never useState for forms |
| HTTP | ofetch → adapters/xhr.ts | ^1.4 | universal (browser/edge/SSR), never fetch() directly |
| Auth | iron-session | ^8.0 | stateless encrypted cookie sessions |
| Server Actions | next-safe-action | ^7.9 | type-safe server actions |
| URL State | nuqs | ^2.4 | for filters/pagination/search params |
| Testing | Vitest + MSW | ^4 / v2 | mock adapters at network layer |
| Validation | Zod | ^4.0 | schemas in *.schema.ts files |

---

## Folder Map — Where Does New Code Go?

```
src/
  __examples__/    REFERENCE ONLY. Read before writing new code.
  adapters/        HTTP functions per domain. Called only from services/.
  app/             Next.js pages + API routes. No business logic.
  components/
    features/      Business components — Ark UI (@ark-ui/react) + plain Tailwind.
  config/          env vars (T3 OSS env-core) + JWT config. No secrets hardcoded.
  constants/       App-wide constants: routes, SEO, static data.
  utils/           Pure utility functions. No side effects. No API calls.
  hooks/           Shared React hooks. File: use-[name].ts
  services/        Business logic. Orchestrates adapters. Called from pages/components.
  stores/          Zustand stores (*.store.tsx) + React Query provider.
  styles/          Global CSS only (Tailwind v4 CSS-first).
  types/           Shared TypeScript types. File: [domain].types.ts
```

---

## Decision Tree 1 — Where to put new code?

```
New page or route?           → src/app/[route]/page.tsx
New API endpoint?            → src/app/api/[name]/route.ts
New business UI component?   → src/components/features/[name].tsx
New HTTP API call?            → src/adapters/[domain]/[domain].adapter.ts
New business logic?          → src/services/[domain].service.ts
New shared global UI state?  → src/stores/[name].store.tsx
New shared React hook?       → src/hooks/use-[name].ts
New app-wide constant?       → src/constants/[name].constant.ts
New shared TypeScript type?  → src/types/[domain].types.ts
New env variable?            → src/config/env.configuration.ts (never process.env directly)
```

---

## Decision Tree 2 — Server Component or Client Component?

```
useState / useEffect / useRef / event handlers?  YES → 'use client'
Browser APIs (window, localStorage)?             YES → 'use client'
TanStack Query hooks?                            YES → 'use client'
onClick / onChange / onSubmit handlers?          YES → 'use client'
Everything else?                                 → Server Component (no directive)

HARD RULES:
  ✗ NEVER 'use client' on layout.tsx
  ✗ NEVER 'use client' on page.tsx unless entire page is client-only
  ✓ Push 'use client' as deep in the component tree as possible
```

---

## Decision Tree 3 — Which state management?

```
API data (async, server)?                → TanStack Query
UI state shared across routes?           → Zustand store
Form fields + validation?                → react-hook-form (NEVER useState)
Local component toggle/counter?          → useState
State from URL (search, filters)?        → useSearchParams / useRouter
```

---

## Naming Conventions

| Thing | Convention | Example |
|-------|------------|---------|
| Component file | kebab-case | `user-profile.tsx` |
| Hook file | `use-` prefix | `use-user-profile.ts` |
| Service file | `.service.ts` | `user.service.ts` |
| Adapter file | `.adapter.ts` | `user.adapter.ts` |
| Schema file | `.schema.ts` | `user.schema.ts` |
| Store file | `.store.tsx` | `user.store.tsx` |
| Zod | ^4.0
| Derived type | `T` prefix | `TUser = z.infer<typeof ZUser>` |
| Constant value | SCREAMING_SNAKE | `API_ROUTES.GET_USER` |
| Service export | camelCase + `Service` | `userService = { ... }` |

---

## Architecture Layering (strict — never skip)

```
app/ → services/ → adapters/ → External API
components/features/ → services/ (never → adapters/ directly)
```

---

## Anti-patterns — Never Do

```
❌ fetch() inside a component           ✓ useQuery or Server Component
❌ 'use client' on layout.tsx           ✓ Only on interactive leaf components
❌ useState for form fields             ✓ react-hook-form
❌ console.log()                        ✓ logger() from @/helpers/logger.helper
❌ Hardcoded URLs/routes                ✓ API_ROUTES / WEB_ROUTES constants
❌ import adapters/ in components       ✓ services/ layer only
❌ type: any                            ✓ unknown + type guard
❌ Business logic in page.tsx           ✓ src/services/
❌ process.env directly                 ✓ env from configurations/
❌ Default export for components        ✓ Named exports (except pages/layouts)
```

---

## Canonical Examples

Read `src/__examples__/` before creating any new feature:
- `_server-data/` — Server Component + async data + Suspense
- `_client-state/` — Client Component + Zustand
- `_form/` — react-hook-form + Zod | ^4.0
- `_full-feature/` — Complete: schema → adapter → service → page → component

---

## Quality Gates (run on every commit)

1. ESLint — architectural violations, no-console
2. TypeScript — tsc --noEmit, zero errors
3. Vitest — unit tests pass
4. Commit format: `type(scope): description`
   - Types: feat, fix, refactor, docs, test, chore, perf, style
