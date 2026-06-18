# Template: New Feature

Use this checklist when creating a new feature end-to-end.
Reference `src/__examples__/_full-feature/` for working code.

## Checklist

### 1. Schema (`src/features/[name]/schemas/[name].schema.ts`)
- [ ] Define Zod object for the entity (`ZEntity = z.object(...)`)
- [ ] Define input schemas for create/update/query
- [ ] Export derived types with `T` prefix (`type TEntity = z.infer<typeof ZEntity>`)

### 2. Adapter (`src/features/[name]/adapters/[name].adapter.ts`)
- [ ] Import `Request` from `@/shared/lib/xhr`
- [ ] Import route constants from `@/shared/constants/routes.constant`
- [ ] One exported async function per endpoint
- [ ] No business logic — raw HTTP only

### 3. Service (`src/features/[name]/services/[name].service.ts`)
- [ ] Import adapter functions (NOT the Request class directly)
- [ ] Export a named `xxxService` object with async methods
- [ ] Add data transforms / orchestration here, not in adapter

### 4. Hook (optional, `src/features/[name]/_hooks/use-[name].ts`)
- [ ] Wrap TanStack Query `useQuery` / `useMutation`
- [ ] Define a `QUERY_KEY` constant at top of file
- [ ] `useMutation` calls `queryClient.invalidateQueries` on success

### 5. Server Component (`src/app/[route]/page.tsx`)
- [ ] No `'use client'`
- [ ] Import from `@/features/[name]` (barrel) — never deep internals
- [ ] Wrap data-fetching children in `<Suspense fallback={<skeleton />}>`
- [ ] Delegate data fetching to async sub-component, not the page itself

### 6. Client Component (`src/features/[name]/_components/[name].tsx`)
- [ ] `'use client'` at top
- [ ] Uses hook from step 4 or `useQuery` calling service directly
- [ ] Handle isLoading, isError states explicitly
- [ ] Named export (not default)

### 7. Barrel export (`src/features/[name]/index.ts`)
- [ ] Export ONLY what `app/` or other consumers need
- [ ] Do NOT export `_components/` or `_hooks/` — those are private

### 8. Tests (`src/__test__/features/[name]/[name].service.test.ts`)
- [ ] `vi.mock('@/features/[name]/adapters/[name].adapter')`
- [ ] Mock env: `vi.mock('@/shared/config/env.configuration', () => ({ env: { ... } }))`
- [ ] Test happy path + error case
- [ ] Do NOT mock the service itself

### 9. Constants
- [ ] Add new API routes to `src/shared/constants/routes.constant.ts`
- [ ] Add new web routes to `WEB_ROUTES` if adding pages

## File Naming
```
src/features/user/schemas/user.schema.ts
src/features/user/adapters/user.adapter.ts
src/features/user/services/user.service.ts
src/features/user/_hooks/use-user.ts
src/features/user/_components/user-list.tsx
src/features/user/index.ts
src/app/users/page.tsx
src/__test__/features/user/user.service.test.ts
```
