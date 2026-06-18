---
name: New Feature
description: Scaffold a complete vertical feature slice following Clean Architecture
trigger: /new-feature
---

# New Feature — Vertical Slice Scaffold

Creates a complete feature following the project's Clean Architecture layering.

## What this generates

```
src/features/[name]/
  schemas/[name].schema.ts      ← Zod schema + derived types
  adapters/[name].adapter.ts    ← HTTP functions (calls shared/lib/xhr)
  services/[name].service.ts    ← Business logic
  _components/[name]-list.tsx   ← Private UI component
  index.ts                      ← Public barrel export
src/__test__/features/[name]/[name].service.test.ts
src/shared/constants/routes.constant.ts  ← add new API_ROUTES
```

## Steps

1. Ask the user: **feature name** (e.g. "product", "order") and **entity fields** (id, name, price, etc.)

2. Generate `schemas/[name].schema.ts`:
   - `Z[Entity]` = Zod object with all fields
   - `ZCreate[Entity]` = Zod object for creation (omit id, createdAt)
   - Export `type T[Entity]` and `type TCreate[Entity]`

3. Generate `adapters/[name].adapter.ts`:
   - Import `Request` from `@/shared/lib/xhr`
   - Import `API_ROUTES` from `@/shared/constants/routes.constant`
   - One exported `async function` per CRUD endpoint
   - **No logic** — pure HTTP

4. Generate `services/[name].service.ts`:
   - Import adapter functions
   - Export `const [name]Service = { get[Entity], create[Entity], update[Entity], delete[Entity] }`
   - Data transforms live here

5. Generate `_components/[name]-list.tsx`:
   - `'use client'`
   - `useQuery({ queryKey: ['[name]s'], queryFn: () => [name]Service.getAll() })`
   - Handle isLoading + isError states

6. Generate `index.ts`:
   - Export only what `app/` needs (service + types)
   - **Do NOT export** `_components/` or `_hooks/`

7. Generate test file:
   - `vi.mock('../adapters/[name].adapter')`
   - Happy path + error case for each service method

8. Add API_ROUTES entries to `src/shared/constants/routes.constant.ts`

## Architecture reminder
```
app/page.tsx → features/[name]/index.ts → services/ → adapters/ → External API
```
Cross-feature imports = ❌. If two features share logic → extract to `shared/`.
