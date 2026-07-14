# Admin Feature-Sliced Design Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/admin` from its custom `app/features/shared` feature-folder layout to canonical Feature-Sliced Design v2.1 without changing routes, visible UI, authentication behavior, or API contracts.

**Architecture:** Use the downward dependency rule `app → pages → widgets → features → entities → shared`. Model reusable `session` and `user` concepts as Entities, use a single `app-shell` Widget for the protected layout, and keep sign-in, create-user, and service-health in their owning Pages because each has only one consumer. Expose every slice/segment through a public API; leave the optional Features layer absent until a reusable interaction appears.

**Tech Stack:** React 19, React Router 7, Rsbuild 2, TypeScript 6 strict, TanStack Query 5, Zustand 5, Panda CSS 1, Vitest 4, Steiger 0.5.13 with `@feature-sliced/steiger-plugin` 0.6.0.

---

## References and baseline

- FSD v2.1 layers and downward import rule: <https://feature-sliced.design/docs/reference/layers>
- Purpose-named segments and slice isolation: <https://feature-sliced.design/docs/reference/slices-segments>
- Public API rule: <https://feature-sliced.design/docs/reference/public-api>
- Baseline on 2026-07-13: admin tests pass `24/24`; Steiger reports `20 errors + 3 warnings`; typecheck already fails in the two `zodResolver(...)` calls because `@hookform/resolvers@5.4.0` is incompatible with `zod@4.4.3`.
- The worktree contains unrelated staged and unstaged changes. Preserve all existing hunks and never stage or commit unrelated files.

## Target file map

```text
apps/admin/
  steiger.config.ts
  src/
    app/
      entrypoint/index.tsx
      providers/{app-providers.tsx,query-provider.tsx,session-events.tsx,index.ts}
      router/{require-auth.tsx,route-error.tsx,route-fallback.tsx,router.tsx,index.ts}
      styles/global.css
    pages/
      dashboard/{api/health.api.ts,model/use-health.ts,ui/dashboard-page.tsx,ui/health-status.tsx,index.ts}
      login/{api/login.api.ts,model/auth.error.ts,model/login.schema.ts,model/use-login.ts,ui/login-form.tsx,ui/login-page.tsx,index.ts}
      not-found/{ui/not-found-page.tsx,index.ts}
      users/{model/create-user.schema.ts,model/use-create-user.ts,ui/user-form.tsx,ui/users-page.tsx,ui/users-table.tsx,index.ts}
    widgets/
      app-shell/{ui/app-shell.tsx,index.ts}
    entities/
      session/{model/session.schema.ts,model/session.store.ts,model/use-session.ts,index.ts}
      user/{api/user.api.ts,model/user.schema.ts,model/use-users.ts,index.ts}
    shared/
      api/{api-client.ts,auth-events.ts,auth-token.ts,query-client.ts,index.ts}
      config/{env.ts,index.ts}
      lib/date/{date.ts,index.ts}
      lib/logger/{logger.ts,index.ts}
      lib/media-query/{use-media-query.ts,index.ts}
      lib/sentry/{sentry.ts,index.ts}
      model/{ui.store.ts,index.ts}
      routes/{routes.ts,index.ts}
      ui/{button.tsx,toaster.tsx,index.ts}
    styled-system/**                     # generated Panda exception; never edit
```

### Task 1: Add the failing architecture gate

**Files:**
- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/admin/steiger.config.ts`

- [ ] Add `steiger@0.5.13` and `@feature-sliced/steiger-plugin@0.6.0` to admin dev dependencies and add `"lint:architecture": "steiger ./src --fail-on-warnings"`.
- [ ] Configure the recommended FSD rules and ignore only `src/__test__/**`, `src/styled-system/**`, and `src/**/*.d.ts`:

```typescript
import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ['src/__test__/**', 'src/styled-system/**', 'src/**/*.d.ts'] },
]);
```

- [ ] Run `pnpm --filter @apps/admin lint:architecture` and verify RED with the existing public-API, segment-name, and layer violations.

### Task 2: Normalize Shared and App segments

**Files:**
- Move the current `shared/components`, `shared/constants`, `shared/hooks`, `shared/lib`, `shared/stores`, `shared/types`, `shared/utils`, `styles`, and `index.tsx` files into the target Shared/App paths above.
- Modify: `apps/admin/rsbuild.config.ts`

- [ ] Create explicit Shared public APIs. Production imports must use only these surfaces:

```typescript
import { apiClient, onUnauthenticated, setAuthToken } from '@/shared/api';
import { ENABLE_MOCK_AUTH, env } from '@/shared/config';
import { formatDate } from '@/shared/lib/date';
import { logger } from '@/shared/lib/logger';
import { useMediaQuery } from '@/shared/lib/media-query';
import { initSentry } from '@/shared/lib/sentry';
import { useUiStore } from '@/shared/model';
import { ROUTES } from '@/shared/routes';
import { AppToaster, Button, toast } from '@/shared/ui';
```

- [ ] Move providers to `app/providers`; put unauthenticated-event coordination in `SessionEvents`; move the root renderer to `app/entrypoint/index.tsx`; point Rsbuild `source.entry` at that file.
- [ ] Remove `Nullable` rather than recreating a generic type bucket; use `string | null` and `TAuthUser | null` at the owning model.
- [ ] Run admin tests and typecheck. Tests must remain green; only the pre-existing resolver type errors may remain.

### Task 3: Extract Session and User entities

**Files:**
- Move auth session schema/store/read hook into `entities/session`.
- Move user schema, in-memory API, and list query into `entities/user`.
- Move mirrored tests under `src/__test__/entities/**`.

- [ ] Keep entity public APIs small:

```typescript
// entities/session/index.ts
export type { TAuthSession, TAuthUser } from './model/session.schema';
export { useSessionStore } from './model/session.store';
export { useSession } from './model/use-session';

// entities/user/index.ts
export { createUser, getUsers } from './api/user.api';
export type { TUser, TUserDraft } from './model/user.schema';
export { USER_ROLES, ZUser, ZUserDraft } from './model/user.schema';
export { USERS_QUERY_KEY, useUsers } from './model/use-users';

```

- [ ] Update tests to import units under test directly and production modules through slice public APIs.
- [ ] Run `pnpm --filter @apps/admin test` and verify all entity behavior remains green.

### Task 4: Keep single-consumer interactions in their Page slices

**Files:**
- Move sign-in API/model/UI into `pages/login`.
- Move create-user model/UI into `pages/users`.
- Move service-health API/model/UI into `pages/dashboard`.
- Move mirrored tests under `src/__test__/pages/**`.

- [ ] Delete both one-line service wrappers. `useLogin` calls same-slice `login` and updates `entities/session`; `useCreateUser` calls `entities/user.createUser` and invalidates `USERS_QUERY_KEY`.
- [ ] Keep Page Public APIs route-focused:

```typescript
export { LoginPage } from './ui/login-page';
export { UsersPage } from './ui/users-page';
```

- [ ] Preserve Zod validation, mock-auth fail-safe behavior, toasts, redirect state, query invalidation, and form reset behavior.
- [ ] Add/adjust tests before implementation where a public behavior lacks coverage, run them RED, implement, then run them GREEN.

### Task 5: Extract Pages and the App Shell widget

**Files:**
- Move route screens from `app/routes` into `pages/*/ui`.
- Move the protected layout to `widgets/app-shell/ui/app-shell.tsx`.
- Keep the users table inside the Users page slice because it is page-specific.
- Keep route guard, fallback, error boundary, and router composition in `app/router`.

- [ ] Compose routes only from public APIs:

```typescript
import { DashboardPage } from '@/pages/dashboard';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { UsersPage } from '@/pages/users';
import { AppShell } from '@/widgets/app-shell';
```

- [ ] Preserve route-level `React.lazy`, `Suspense`, protected-route redirect state, error reporting, navigation paths, responsive shell, and URL-synced user search.
- [ ] Run admin test, lint, typecheck, and build.

### Task 6: Enforce FSD boundaries and update repository guidance

**Files:**
- Modify: `apps/admin/eslint.config.mjs`
- Modify: `AGENTS.md`
- Modify: `README.md` only where it makes an inaccurate admin architecture claim.

- [ ] Replace the custom `app/features/shared` restrictions with explicit protection against public-API sidesteps; leave Steiger as the source of truth for layer direction, slice isolation, segment names, and public APIs.
- [ ] Update `AGENTS.md` so canonical FSD v2.1 is scoped to both frontend apps while documenting the framework-specific dapp `_app/_pages` names and the normal admin `app/pages` names. Update HTTP examples, test paths, import order, and private-segment guidance without touching the ongoing backend architecture hunks.
- [ ] Run `pnpm --filter @apps/admin lint:architecture`; expected: zero errors and zero warnings.

### Task 7: Resolve the baseline resolver incompatibility and verify all gates

**Files:**
- Modify only the dependency or resolver call sites required by the confirmed compatibility fix.

- [ ] Confirm the current supported `@hookform/resolvers`/Zod pairing from primary package documentation or registry metadata. Prefer a compatible dependency update; do not silence the types with `any` or an unsafe cast.
- [ ] Run focused admin gates:

```bash
pnpm --filter @apps/admin typecheck
pnpm --filter @apps/admin lint
pnpm --filter @apps/admin lint:architecture
pnpm --filter @apps/admin test
pnpm --filter @apps/admin build
```

- [ ] Run repository definition-of-done gates:

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
```

- [ ] Inspect `git diff -- apps/admin AGENTS.md README.md pnpm-lock.yaml` and verify no generated files or unrelated worktree changes were overwritten.

## Self-review

- **Spec coverage:** The plan addresses missing Pages/Entities/Widgets layers, single-consumer interactions incorrectly modeled as Features, nonstandard segment names, missing public APIs, deep imports, and absent architecture enforcement.
- **Behavior safety:** Existing route, session, form, query, health, table, Sentry, and responsive-layout behavior is preserved and covered by the existing Vitest suite plus focused additions where needed.
- **Scope safety:** Generated Panda output, deployment, backend work, and unrelated staged/unstaged changes remain untouched.
