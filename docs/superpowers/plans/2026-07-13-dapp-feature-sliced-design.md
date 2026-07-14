# Dapp Feature-Sliced Design Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/dapp` from its custom vertical-feature layout to canonical Feature-Sliced Design v2.1 without changing its routes, authentication contract, visual output, or deployment behavior.

**Architecture:** Keep Next.js framework entrypoints in `apps/dapp/app` and the project root, and keep all FSD code under `apps/dapp/src`. Use the downward dependency rule `_app → _pages → widgets → features → entities → shared`; instantiate only `_app`, `_pages`, `features/sign-in`, `entities/session`, and `shared` because the current product has no reusable widget and sign-out is account-page-specific. Every slice and every segment on `_app`/`shared` exposes an explicit public API, with `index.server.ts`/`index.client.ts` where React Server Component boundaries require it.

**Tech Stack:** Next.js 16 App Router on vinext/Vite, React 19, TypeScript 6 strict, TanStack Query 5, next-safe-action 8, Zod 4, Panda CSS 1, Vitest 4, Playwright, Steiger 0.5.13 with `@feature-sliced/steiger-plugin` 0.6.0.

---

## Audit baseline

- Official FSD v2.1 defines the layers `app`, `pages`, `widgets`, `features`, `entities`, and `shared`, with imports allowed only toward lower layers: <https://feature-sliced.design/docs/reference/layers>.
- Official Next.js guidance recommends keeping the Next router outside the FSD source root and naming the FSD layers `_app`/`_pages` to avoid collisions. It also recommends `index.server.ts` for server-only slice exports: <https://feature-sliced.design/docs/guides/tech/with-nextjs>.
- FSD segments group by purpose (`ui`, `api`, `model`, `lib`, `config`), not by file essence (`components`, `hooks`, `types`, `utils`): <https://feature-sliced.design/docs/reference/slices-segments>.
- The current command below reports 18 errors and 5 warnings, including missing public APIs, a segmentless `features/auth` slice, public-API sidesteps, and purpose-less segment names:

```bash
pnpm --package=steiger@0.5.13 \
  --package=@feature-sliced/steiger-plugin@0.6.0 \
  dlx steiger apps/dapp/src
```

- The worktree already contains unrelated backend, CI, documentation, and dependency changes. Before every task, inspect `git diff -- <listed paths>` and preserve all pre-existing hunks. Do not stage or commit unrelated files.

## Target file map

```text
apps/dapp/
  app/                                      # Next.js entrypoints only
    account/page.tsx
    api/auth/login/route.ts
    api/auth/me/route.ts
    api/health/route.ts
    api/mock/route.ts
    sign-in/page.tsx
    error.tsx
    global-error.tsx
    layout.tsx
    loading.tsx
    manifest.ts
    not-found.tsx
    page.tsx
    robots.ts
    sitemap.ts
  instrumentation.ts                       # Next.js required root entrypoint
  instrumentation-client.ts                # Next.js required root entrypoint
  proxy.ts                                 # Next.js 16 required root entrypoint
  steiger.config.ts
  src/
    _app/
      get-current-session-route.ts
      get-health-route.ts
      get-mock-route.ts
      post-login-route.ts
      errors/
        error-page.tsx
        global-error-page.tsx
        index.ts
      instrumentation/
        instrumentation.client.ts
        instrumentation.server.ts
        index.client.ts
        index.server.ts
      metadata/
        app-metadata.ts
        json-ld.tsx
        manifest.ts
        robots.ts
        sitemap.ts
        index.ts
      providers/
        app-providers.tsx
        devtools.tsx
        query-provider.tsx
        web-vitals.tsx
        index.ts
      proxy/
        proxy.ts
        index.ts
      styles/index.css
    _pages/
      account/
        api/logout.action.ts
        model/use-logout.ts
        ui/account-page.tsx
        ui/account-session.tsx
        index.server.ts
      home/
        ui/home-page.tsx
        index.ts
      not-found/
        ui/not-found-page.tsx
        index.ts
      sign-in/
        ui/sign-in-page.tsx
        index.ts
    features/
      sign-in/
        api/login.api.ts
        model/login.error.ts
        model/login.schema.ts
        model/use-login.ts
        model/verify-credentials.server.ts
        ui/login-form.tsx
        index.ts
        index.server.ts
    entities/
      session/
        api/session.api.ts
        api/session.server.ts
        model/session.constants.ts
        model/session.mapper.ts
        model/session.query.ts
        model/session.schema.ts
        index.ts
        index.client.ts
        index.server.ts
    shared/
      api/
        action-client.ts
        xhr.ts
        index.ts
        index.server.ts
      config/
        env.ts
        index.ts
      lib/
        case-conversion/{case-conversion.ts,index.ts}
        logger/{logger.ts,index.ts}
        rate-limit/{rate-limit.ts,index.ts}
        url/{url.ts,index.ts}
      routes/
        routes.ts
        index.ts
      ui/
        page-loader.tsx
        toaster.tsx
        toaster.store.ts
        index.ts
        index.client.ts
```

`widgets/` is intentionally absent. The only candidate, the account session block, is used by one page and makes up that page's main content, so FSD v2.1 places it directly in the account page slice. Sign-out is also account-page-specific and remains in that page slice. `features/sign-in` stays a feature because its public APIs are consumed independently by the sign-in page and the application-level login Route Handler.

### Task 1: Add a failing architecture gate

**Files:**
- Modify: `apps/dapp/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/dapp/steiger.config.ts`

- [ ] **Step 1: Install the official architecture linter in the dapp workspace**

Run:

```bash
pnpm --filter @apps/dapp add -D steiger@0.5.13 @feature-sliced/steiger-plugin@0.6.0
```

Expected: only `apps/dapp/package.json` and the existing `pnpm-lock.yaml` dependency graph gain the two dev dependencies; all pre-existing dependency upgrades remain intact.

- [ ] **Step 2: Add the Steiger configuration**

Create `apps/dapp/steiger.config.ts`:

```typescript
import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['src/__test__/**', 'src/styled-system/**', 'src/**/*.d.ts'],
  },
  {
    files: ['./src/_pages/**'],
    rules: {
      // Next route wrappers live outside the FSD root, so this heuristic
      // cannot see the valid external consumer of each page slice.
      'fsd/insignificant-slice': 'off',
    },
  },
]);
```

- [ ] **Step 3: Wire the gate into the workspace lint command**

Set these scripts in `apps/dapp/package.json`, preserving all other scripts:

```json
{
  "lint": "vinext lint && pnpm lint:architecture",
  "lint:architecture": "steiger ./src --fail-on-warnings"
}
```

- [ ] **Step 4: Prove the architecture test fails before migration**

Run:

```bash
pnpm --filter @apps/dapp lint:architecture
```

Expected: exit code 1 with the existing FSD violations. Save the count in the task notes; do not weaken recommended rules to make the old layout pass.

- [ ] **Step 5: Commit only this task if commits are requested**

```bash
git add apps/dapp/package.json apps/dapp/steiger.config.ts pnpm-lock.yaml
git commit -m "test(dapp): add Feature-Sliced Design architecture gate"
```

### Task 2: Separate Next.js entrypoints from the FSD source root

**Files:**
- Move: `apps/dapp/src/app/**` → `apps/dapp/app/**`
- Move: `apps/dapp/src/proxy.ts` → `apps/dapp/src/_app/proxy/proxy.ts`
- Move: `apps/dapp/src/instrumentation.ts` → `apps/dapp/src/_app/instrumentation/instrumentation.server.ts`
- Create: `apps/dapp/src/_app/instrumentation/instrumentation.client.ts`
- Modify: `apps/dapp/instrumentation-client.ts`
- Create: `apps/dapp/proxy.ts`
- Create: `apps/dapp/instrumentation.ts`
- Create: `apps/dapp/src/_app/proxy/index.ts`
- Create: `apps/dapp/src/_app/instrumentation/index.server.ts`
- Create: `apps/dapp/src/_app/instrumentation/index.client.ts`
- Modify: `apps/dapp/panda.config.ts`
- Modify: `apps/dapp/vitest.config.mts`

- [ ] **Step 1: Move the Next router directory as one history-preserving operation**

Run:

```bash
git mv apps/dapp/src/app apps/dapp/app
mkdir -p apps/dapp/src/_app/proxy apps/dapp/src/_app/instrumentation
git mv apps/dapp/src/proxy.ts apps/dapp/src/_app/proxy/proxy.ts
git mv apps/dapp/src/instrumentation.ts apps/dapp/src/_app/instrumentation/instrumentation.server.ts
```

Expected: route behavior is unchanged; only paths move.

- [ ] **Step 2: Add environment-specific public APIs**

Create `apps/dapp/src/_app/proxy/index.ts`:

```typescript
export { handleProxy } from './proxy';
```

Rename the default proxy function in `proxy.ts` without changing its body:

```diff
-export default async function proxy(
+export async function handleProxy(
   request: NextRequest,
 ): Promise<NextResponse> {
```

Keep `config` in the implementation file for unit tests, but copy the static matcher to the root entrypoint because Next.js must statically analyze it. Create `apps/dapp/proxy.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { handleProxy } from './src/_app/proxy';

export function proxy(request: NextRequest) {
  return handleProxy(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
```

Create `apps/dapp/src/_app/instrumentation/index.server.ts`:

```typescript
export { onRequestError, register } from './instrumentation.server';
```

Create `apps/dapp/instrumentation.ts`:

```typescript
export { onRequestError, register } from './src/_app/instrumentation/index.server';
```

Move the existing Sentry initialization body from root `instrumentation-client.ts` to `src/_app/instrumentation/instrumentation.client.ts`, preserving its exports. Create `src/_app/instrumentation/index.client.ts`:

```typescript
export { onRouterTransitionStart } from './instrumentation.client';
```

Update the moved instrumentation modules' root-relative imports:

```typescript
// instrumentation.server.ts
await import('../../../sentry.server.config');
await import('../../../sentry.edge.config');

// instrumentation.client.ts
import pkg from '../../../package.json';
```

Because the router moved one directory toward the workspace root, update the temporary health entrypoint before Task 7 moves its implementation:

```typescript
import pkg from '../../../package.json';
```

Replace root `instrumentation-client.ts` with:

```typescript
export { onRouterTransitionStart } from './src/_app/instrumentation/index.client';
```

- [ ] **Step 3: Teach Panda to scan both framework and FSD code**

Set the `include` field in `apps/dapp/panda.config.ts` to:

```typescript
include: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
```

- [ ] **Step 4: Update the proxy test and coverage paths**

In `src/__test__/proxy.test.ts`, replace the implementation import with:

```typescript
import { handleProxy } from '@/_app/proxy';
```

Replace each call from `proxy(req)` to `handleProxy(req)`. In `vitest.config.mts`, remove the obsolete `src/app/**` coverage exclusions because framework routes now live outside `src`; later tasks add exact `_pages`/`_app` UI exclusions.

Update the two Route Handler tests immediately because `@/*` continues to map only to `src/*` after the router moves:

```typescript
// src/__test__/app/api/auth/login/route.test.ts
import { POST } from '../../../../../../app/api/auth/login/route';

// src/__test__/app/api/mock/route.test.ts
await import('../../../../../app/api/mock/route');
```

Change the dapp ESLint route override from `src/app/**/*.{ts,tsx}` to `app/**/*.{ts,tsx}` in the same task so the move does not create an unenforced interval.

- [ ] **Step 5: Run the focused proxy test**

Run:

```bash
pnpm --filter @apps/dapp exec vitest run src/__test__/proxy.test.ts
```

Expected: all proxy tests pass.

- [ ] **Step 6: Commit only this task if commits are requested**

```bash
git add apps/dapp/app apps/dapp/proxy.ts apps/dapp/instrumentation.ts \
  apps/dapp/instrumentation-client.ts apps/dapp/src/_app \
  apps/dapp/eslint.config.mjs apps/dapp/src/__test__/app \
  apps/dapp/panda.config.ts apps/dapp/vitest.config.mts \
  apps/dapp/src/__test__/proxy.test.ts
git commit -m "refactor(dapp): separate Next entrypoints from FSD source"
```

### Task 3: Normalize the Shared and App layers

**Files:**
- Move: `src/shared/config/env.configuration.ts` → `src/shared/config/env.ts`
- Move: `src/shared/constants/routes.constant.ts` → `src/shared/routes/routes.ts`
- Move: `src/shared/lib/xhr.ts` → `src/shared/api/xhr.ts`
- Move: `src/shared/lib/action-client.ts` → `src/shared/api/action-client.ts`
- Move: `src/shared/lib/rate-limit.ts` → `src/shared/lib/rate-limit/rate-limit.ts`
- Move: `src/shared/utils/case.helper.ts` → `src/shared/lib/case-conversion/case-conversion.ts`
- Move: `src/shared/utils/logger.helper.ts` → `src/shared/lib/logger/logger.ts`
- Move: `src/shared/utils/sanitize.helper.ts` → `src/shared/lib/url/url.ts`
- Move: `src/shared/components/ui/toaster.tsx` → `src/shared/ui/toaster.tsx`
- Move: `src/shared/lib/toaster.ts` → `src/shared/ui/toaster.store.ts`
- Move: `src/shared/components/providers/*` → `src/_app/providers/*`
- Move: `src/shared/stores/react-query.store.tsx` → `src/_app/providers/query-provider.tsx`
- Move: `src/shared/constants/seo.constant.ts` → `src/_app/metadata/app-metadata.ts`
- Move: `src/shared/components/seo/json-ld.tsx` → `src/_app/metadata/json-ld.tsx`
- Move: `src/styles/global.style.css` → `src/_app/styles/index.css`
- Create: public API files listed below
- Delete: `src/shared/types/**` after confirming `rg` finds zero consumers

- [ ] **Step 1: Run the required modern frontend guidance lookup before changing TSX**

Run:

```bash
npx -y modern-web-guidance@latest search \
  "preserve React providers accessible loading UI and client boundaries during a Next.js architecture refactor" \
  --skill-version 2026_05_16-c5e7870
```

Retrieve every returned guide with similarity at least `0.65`, then record the IDs in the task notes. This migration keeps behavior and markup stable unless a retrieved guide identifies a concrete correctness issue.

- [ ] **Step 2: Move modules into purpose-named segments**

Use `mkdir -p` for the target directories and `git mv` for every listed move. Rename exports while preserving behavior:

```typescript
// src/_app/providers/query-provider.tsx
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

Keep the existing `makeQueryClient`, browser singleton, Devtools, WebVitals, toaster rendering, environment validation, xhr options, rate limiter, logger, case-conversion, and URL-safety implementations unchanged apart from imports and names.

Preserve `'use client'` on `devtools.tsx`, `web-vitals.tsx`, `query-provider.tsx`, `toaster.tsx`, and `toaster.store.ts`. Keep `app-providers.tsx` and `_app/providers/index.ts` server-capable. Within `shared/ui/toaster.tsx`, import `toaster` relatively from `./toaster.store`; importing the segment's public API from inside itself would create a barrel cycle.

- [ ] **Step 3: Add explicit public APIs**

Create these files exactly:

```typescript
// src/shared/api/index.ts
export { FetchError, xhr } from './xhr';

// src/shared/api/index.server.ts
import 'server-only';

export { ActionError, actionClient } from './action-client';

// src/shared/config/index.ts
export { env } from './env';

// src/shared/routes/index.ts
export { API_ROUTES, WEB_ROUTES } from './routes';

// src/shared/lib/case-conversion/index.ts
export { camelizeKeys, snakifyKeys } from './case-conversion';

// src/shared/lib/logger/index.ts
export { createTaggedLogger, logger } from './logger';

// src/shared/lib/rate-limit/index.ts
export { isRateLimited } from './rate-limit';

// src/shared/lib/url/index.ts
export { isSafeRedirectPath, isValidOrigin, sanitizeUrl } from './url';

// src/shared/ui/index.client.ts
'use client';

export { AppToaster } from './toaster';
export { toaster } from './toaster.store';

// src/_app/providers/index.ts
export { AppProviders } from './app-providers';

// src/_app/metadata/index.ts
export {
  APP_DESCRIPTION,
  APP_NAME,
  META_DATA_DEFAULT,
  VIEWPORT_DEFAULT,
} from './app-metadata';
export { WebsiteJsonLd } from './json-ld';
```

Create `src/_app/providers/app-providers.tsx`:

```typescript
import { AppToaster } from '@/shared/ui/index.client';
import { Devtools } from './devtools';
import { QueryProvider } from './query-provider';
import { WebVitals } from './web-vitals';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WebVitals />
      <QueryProvider>
        {children}
        <Devtools />
        <AppToaster />
      </QueryProvider>
    </>
  );
}
```

- [ ] **Step 4: Replace all public imports**

Use these exact import surfaces throughout dapp code, tests, and root config files:

```typescript
import { FetchError, xhr } from '@/shared/api';
import { ActionError, actionClient } from '@/shared/api/index.server';
import { env } from '@/shared/config';
import { camelizeKeys, snakifyKeys } from '@/shared/lib/case-conversion';
import { logger } from '@/shared/lib/logger';
import { isRateLimited } from '@/shared/lib/rate-limit';
import { isSafeRedirectPath } from '@/shared/lib/url';
import { API_ROUTES, WEB_ROUTES } from '@/shared/routes';
import { AppToaster, toaster } from '@/shared/ui/index.client';
```

No production module may import an internal file behind any of these public APIs. Update `app/layout.tsx` in this task to consume `_app/metadata`, `_app/providers`, and `_app/styles/index.css`; do not leave it pointing at moved Shared files until Task 6.

- [ ] **Step 5: Update root configuration imports**

In `next.config.ts`, execute and type the public config API:

```typescript
const { env } = await jiti.import<typeof import('./src/shared/config/index.ts')>(
  './src/shared/config/index.ts',
);
```

Update both the generic type path and the jiti runtime string exactly as shown. Update both Sentry config files and the `_app/instrumentation` client module to import `env` from `@/shared/config`.

- [ ] **Step 6: Remove unused generic type buckets**

Run:

```bash
rg -n "@/shared/types|T(ApiResponse|ApiError|PaginatedResponse|PaginationQuery|Id|Timestamps|WithId|WithTimestamps|SelectOption|Children|ClassName|Optional)" apps/dapp --glob '*.{ts,tsx}'
```

Expected: definitions only. Delete `src/shared/types/api.types.ts`, `common.types.ts`, and `index.ts`; FSD forbids a purpose-less `types` dumping ground.

- [ ] **Step 7: Run Shared tests**

Run:

```bash
pnpm --filter @apps/dapp exec vitest run \
  src/__test__/shared/lib/action-client.test.ts \
  src/__test__/shared/lib/rate-limit.test.ts \
  src/__test__/shared/utils/case.helper.test.ts \
  src/__test__/shared/utils/sanitize.helper.test.ts
```

Expected: all tests pass after their imports switch to the new public APIs. Renaming test directories happens in Task 8.

Also update every matching env mock ID to `@/shared/config`, including `src/__test__/proxy.test.ts` and all occurrences in `src/__test__/server/lib/auth.test.ts`. Run the broader checkpoint:

```bash
pnpm --filter @apps/dapp exec vitest run \
  src/__test__/proxy.test.ts \
  src/__test__/server/lib/auth.test.ts \
  src/__test__/app/api/auth/login/route.test.ts \
  src/__test__/shared
pnpm --filter @apps/dapp typecheck
```

Expected: focused tests and typecheck pass. The earlier `zodResolver` TS2769 was traced to a stale pnpm hoist resolving the resolver's `zod/v4/core` through Steiger's compatibility copy (`zod@3.25`) while the app schema used `zod@4.4.3`; a synchronized install resolves both to `zod@4.4.3`. If it recurs, run `pnpm install --frozen-lockfile` and re-run typecheck—do not cast the schema or change valid resolver code.

- [ ] **Step 8: Commit only this task if commits are requested**

```bash
git add apps/dapp/app/layout.tsx apps/dapp/src apps/dapp/next.config.ts apps/dapp/sentry.*.config.ts
git commit -m "refactor(dapp): normalize FSD app and shared segments"
```

### Task 4: Extract the Session entity

**Files:**
- Move: `src/shared/schemas/session.schema.ts` → `src/entities/session/model/session.schema.ts`
- Move: `src/shared/constants/session.constant.ts` → `src/entities/session/model/session.constants.ts`
- Move: `src/server/lib/session.ts` → `src/entities/session/api/session.server.ts`
- Extract from: `src/features/auth/adapters/auth.adapter.ts` → `src/entities/session/api/session.api.ts`
- Extract from: `src/features/auth/_hooks/use-session.ts` → `src/entities/session/model/session.query.ts`
- Extract from: `src/features/auth/services/auth.server.service.ts` → `src/entities/session/api/session.server.ts`
- Create: `src/entities/session/model/session.mapper.ts`
- Create: `src/entities/session/index.ts`
- Create: `src/entities/session/index.client.ts`
- Create: `src/entities/session/index.server.ts`

- [ ] **Step 1: Move session schemas, constants, and server persistence**

Preserve the current Zod schemas, cookie options, and placeholder-secret protection. Rename the mutable iron-session accessor to `getMutableSession`, keep the raw user read private, and project the public shape before data crosses an RSC or HTTP boundary:

```typescript
// model/session.mapper.ts
export const toPublicSession = (
  user: TServerSessionUser | null | undefined,
): TSessionData => {
  if (!user) return { isLoggedIn: false };
  const { id, email, name, avatarUrl } = user;
  return { isLoggedIn: true, user: { id, email, name, avatarUrl } };
};

// api/session.server.ts
export const getMutableSession = async () => {
  const cookieStore = await cookies();
  return getIronSession<TServerSessionData>(cookieStore, SESSION_OPTIONS);
};

export const getPublicSession = async (): Promise<TSessionData> => {
  const user = await getSessionUser();
  return toPublicSession(user);
};
```

This projection is required because `TServerSessionUser` may contain `accessToken`; structural typing alone would allow that extra field into the client RSC payload.

- [ ] **Step 2: Move the client session request into the entity API**

Create `session.api.ts` with the current `getSessionAPI` body and rename it:

```typescript
import { xhr } from '@/shared/api';
import { API_ROUTES } from '@/shared/routes';
import type { TSessionData } from '../model/session.schema';

export const fetchSession = async (): Promise<TSessionData> => {
  try {
    return await xhr<TSessionData>(API_ROUTES.AUTH_ME);
  } catch {
    return { isLoggedIn: false };
  }
};
```

This task deliberately preserves the existing fallback contract. A later behavioral change may introduce a typed session-load error and retry UI, but that is outside this architecture migration.

- [ ] **Step 3: Move the TanStack Query model**

Create `session.query.ts`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSession } from '../api/session.api';
import { SESSION_QUERY_KEY } from './session.constants';
import type { TSessionData } from './session.schema';

export const useSession = (initialData?: TSessionData) =>
  useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 60_000,
    initialData,
  });
```

- [ ] **Step 4: Add client-safe and server-only public APIs**

Create `src/entities/session/index.ts`:

```typescript
export {
  type TServerSessionData,
  type TServerSessionUser,
  type TSessionData,
  type TSessionUser,
  ZSessionData,
  ZSessionUser,
} from './model/session.schema';
export {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  SESSION_QUERY_KEY,
} from './model/session.constants';
```

Add this constant to `model/session.constants.ts`:

```typescript
export const SESSION_QUERY_KEY = ['auth', 'session'] as const;
```

Create `src/entities/session/index.client.ts`:

```typescript
'use client';

export { useSession } from './model/session.query';
```

Create `src/entities/session/index.server.ts`:

```typescript
import 'server-only';

export { getMutableSession, getPublicSession } from './api/session.server';
export type {
  TServerSessionData,
  TServerSessionUser,
  TSessionData,
} from './model/session.schema';
```

- [ ] **Step 5: Point proxy and tests at the entity public API**

The proxy imports cookie constants and `TServerSessionData` from `@/entities/session`. Client Components import `useSession` from `@/entities/session/index.client`. Server Components use `getPublicSession`; Route Handlers and server actions use `getMutableSession`. Both server functions come from `@/entities/session/index.server`. Always provide a `vi.mock(..., factory)` when mocking the server public API so Vitest never evaluates `server-only` first.

Keep this checkpoint compilable by updating every remaining legacy consumer in the same task: `features/auth/schemas/auth.schema.ts` temporarily re-exports session types/schemas from `@/entities/session`; `AuthStatus` imports `useSession` from the entity client API; the account page calls `getPublicSession`; both auth Route Handlers and `logoutAction` use the new server API; the proxy uses the universal entity API. Delete the now-empty `features/auth/services/auth.server.service.ts`, `features/auth/server.ts`, and `src/server/lib/session.ts` source location only after all consumers point at the entity.

Also repoint the still-temporary `src/server/lib/auth.ts` type import from the moved Shared schema to `TServerSessionUser` from `@/entities/session`; Task 5 moves that verifier into the Sign-in feature.

Trim `features/auth/index.ts` so it no longer re-exports the extracted `useSession` or server-session service. In the login Route Handler test, replace the `@/server/lib/session` import/mock with a factory mock of `@/entities/session/index.server` exposing `getMutableSession`; this keeps the Task 4 checkpoint isolated from real cookies/env.

- [ ] **Step 6: Run session and proxy tests**

Before running them, add a regression case to the session server test: make the stored user include `accessToken: 'server-secret'`, call `getPublicSession()`, and assert the returned `user` equals only `{ id, email, name, avatarUrl }` and does not have an `accessToken` property.

Run:

```bash
pnpm --filter @apps/dapp exec vitest run \
  src/__test__/features/auth/auth.adapter.test.ts \
  src/__test__/features/auth/auth.server.service.test.ts \
  src/__test__/proxy.test.ts
```

Expected: the session-focused cases pass from their new entity imports. File moves occur in Task 8.

- [ ] **Step 7: Commit only this task if commits are requested**

```bash
git add apps/dapp/app apps/dapp/src/entities apps/dapp/src/features/auth \
  apps/dapp/src/_app/proxy apps/dapp/src/__test__
git commit -m "refactor(dapp): model session as an FSD entity"
```

### Task 5: Replace the broad Auth slice with the Sign-in feature

**Files:**
- Move: `features/auth/_components/login-form.tsx` → `features/sign-in/ui/login-form.tsx`
- Move: `features/auth/adapters/auth.adapter.ts` login code → `features/sign-in/api/login.api.ts`
- Move: `features/auth/errors/auth.error.ts` → `features/sign-in/model/login.error.ts`
- Move: `features/auth/schemas/auth.schema.ts` login schema → `features/sign-in/model/login.schema.ts`
- Move: `features/auth/_hooks/use-session.ts` login hook → `features/sign-in/model/use-login.ts`
- Move: `server/lib/auth.ts` → `features/sign-in/model/verify-credentials.server.ts`
- Create: `features/sign-in/index.ts`
- Create: `features/sign-in/index.server.ts`
- Delete after extraction: `server/**`; retain the account/logout remainder of `features/auth` until Task 6

- [ ] **Step 1: Move the login UI, API, schema, error, and credential verifier**

Keep all current form fields, labels, accessibility attributes, redirect sanitization, typed errors, constant-time comparison, and placeholder-password protection. Rename only the feature-level concepts:

```typescript
// api/login.api.ts
import { FetchError, xhr } from '@/shared/api';
import { API_ROUTES } from '@/shared/routes';
import { AuthError } from '../model/login.error';
import type { TLoginInput } from '../model/login.schema';

export const login = async (input: TLoginInput): Promise<void> => {
  try {
    await xhr(API_ROUTES.AUTH_LOGIN, { method: 'POST', body: input });
  } catch (error) {
    if (error instanceof FetchError && error.status === 401) {
      throw new AuthError(
        'invalid_credentials',
        'Incorrect email or password.',
      );
    }
    throw new AuthError(
      'request_failed',
      'Login request failed. Please try again.',
    );
  }
};

// model/use-login.ts
export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
  });
};
```

`use-login.ts` imports `SESSION_QUERY_KEY` from `@/entities/session`; this is a legal Features → Entities dependency.

- [ ] **Step 2: Make the login schema feature-owned**

`login.schema.ts` contains only `ZLoginInput` and `TLoginInput`. Session schemas are no longer re-exported through the sign-in feature.

- [ ] **Step 3: Add minimal public APIs**

Create `features/sign-in/index.ts`:

```typescript
export { LoginForm } from './ui/login-form';
```

Create `features/sign-in/index.server.ts`:

```typescript
import 'server-only';

export { verifyCredentials } from './model/verify-credentials.server';
export { type TLoginInput, ZLoginInput } from './model/login.schema';
```

Do not expose the feature's API request, error class, or hook unless a second external consumer needs them.

Update `app/sign-in/page.tsx` to consume `LoginForm` from `@/features/sign-in`. Update the login Route Handler to consume `ZLoginInput` and `verifyCredentials` from `@/features/sign-in/index.server`. Trim the temporary `features/auth/index.ts` to exports still required only by the account route; do not delete `AuthStatus`, `logoutAction`, or the logout hook in this task.

Update the login Route Handler test in this task: replace `@/server/lib/auth` with a factory mock of `@/features/sign-in/index.server` that provides both `verifyCredentials` and `ZLoginInput`. This prevents the test from evaluating real server-only env code before Task 8 moves the file.

- [ ] **Step 4: Remove the obsolete service layer**

Delete `auth.service.ts` rather than recreating it. In canonical FSD, the feature's `model/use-login.ts` calls its same-slice `api/login.api.ts` directly; a one-line pass-through service adds no boundary or business value. Delete the remaining `features/auth` directory only after Task 6 moves its account-specific files.

- [ ] **Step 5: Run sign-in tests**

Run:

```bash
pnpm --filter @apps/dapp exec vitest run \
  src/__test__/features/auth/auth.adapter.test.ts \
  src/__test__/server/lib/auth.test.ts
```

Expected: login request/error cases and credential verification cases pass using the new feature paths. Delete `auth.service.test.ts`; it tests only the removed pass-through implementation.

- [ ] **Step 6: Commit only this task if commits are requested**

```bash
git add apps/dapp/app/sign-in apps/dapp/app/api/auth/login \
  apps/dapp/src/features apps/dapp/src/entities apps/dapp/src/__test__
git commit -m "refactor(dapp): isolate sign-in as an FSD feature"
```

### Task 6: Extract FSD page slices and thin Next page entrypoints

**Files:**
- Move: `app/page.tsx` UI → `src/_pages/home/ui/home-page.tsx`
- Move: `app/sign-in/page.tsx` UI → `src/_pages/sign-in/ui/sign-in-page.tsx`
- Move: `app/account/page.tsx` UI → `src/_pages/account/ui/account-page.tsx`
- Move: `features/auth/_components/auth-status.tsx` → `src/_pages/account/ui/account-session.tsx`
- Move: `features/auth/actions/auth.action.ts` → `src/_pages/account/api/logout.action.ts`
- Move: logout hook → `src/_pages/account/model/use-logout.ts`
- Move: `app/not-found.tsx` UI → `src/_pages/not-found/ui/not-found-page.tsx`
- Create: one `index.ts` per page slice
- Replace: Next page files with entrypoint re-exports

- [ ] **Step 1: Move each screen into a page slice**

Change default exports to named exports because only Next special files may default-export:

```diff
-export default function HomePage() {
+export function HomePage() {

-export default function SignInPage() {
+export function SignInPage() {

-export default async function AccountPage() {
+export async function AccountPage() {

-const NotFound = () => {
+export const NotFoundPage = () => {

-export default NotFound;
```

In the home content, replace the architecture feature card with:

```typescript
{
  icon: Layers,
  title: 'Feature-Sliced Design',
  description:
    'Canonical layers, isolated slices, purpose-named segments, and explicit public APIs enforced by Steiger.',
},
```

- [ ] **Step 2: Keep account-specific sign-out inside the Account page slice**

Create `model/use-logout.ts` from the current logout mutation. It imports `SESSION_QUERY_KEY` from `@/entities/session` and the same-slice `logoutAction` relatively. `api/logout.action.ts` imports `getMutableSession` from `@/entities/session/index.server` and `actionClient` from `@/shared/api/index.server`.

Rename the moved component and keep its existing body:

```diff
-export function AuthStatus({
+export function AccountSession({
```

`ui/account-session.tsx` imports `useSession` from `@/entities/session/index.client`, imports `TSessionData` from `@/entities/session`, imports `useLogout` relatively, and keeps the current loading, signed-out, user-name, and button states unchanged.

`ui/account-page.tsx` imports `getPublicSession` from `@/entities/session/index.server`, renders the existing heading, and passes the projected result to `AccountSession`.

After the account UI, logout action, and logout hook have moved, delete the remaining `src/features/auth/index.ts`, emptied `_hooks/use-session.ts`, and the `src/features/auth` directory. Task 6 owns the final removal; Task 5 intentionally kept these temporary consumers alive.

- [ ] **Step 3: Add page public APIs**

Create:

```typescript
// src/_pages/home/index.ts
export { HomePage } from './ui/home-page';

// src/_pages/sign-in/index.ts
export { SignInPage } from './ui/sign-in-page';

// src/_pages/account/index.server.ts
import 'server-only';

export { AccountPage } from './ui/account-page';

// src/_pages/not-found/index.ts
export { NotFoundPage } from './ui/not-found-page';
```

- [ ] **Step 4: Reduce Next page files to framework entrypoints**

Use these complete contents:

```typescript
// app/page.tsx
export { HomePage as default } from '@/_pages/home';

// app/sign-in/page.tsx
export { SignInPage as default } from '@/_pages/sign-in';

// app/account/page.tsx
export { AccountPage as default } from '@/_pages/account/index.server';

// app/not-found.tsx
export { NotFoundPage as default } from '@/_pages/not-found';
```

- [ ] **Step 5: Update layout to compose App-layer providers**

`app/layout.tsx` keeps the required `<html>` and `<body>` structure, font setup, metadata exports, and Panda classes. Its FSD imports become:

```typescript
import { META_DATA_DEFAULT, VIEWPORT_DEFAULT, WebsiteJsonLd } from '@/_app/metadata';
import { AppProviders } from '@/_app/providers';
import '@/_app/styles/index.css';
```

Inside `<body>`, render:

```tsx
<WebsiteJsonLd />
<AppProviders>{children}</AppProviders>
```

- [ ] **Step 6: Run page-level E2E smoke tests**

Run:

```bash
pnpm --filter @apps/dapp exec playwright test e2e/smoke.test.ts e2e/navigation.test.ts
```

Expected: routes and visible page behavior remain unchanged apart from the architecture marketing copy.

- [ ] **Step 7: Commit only this task if commits are requested**

```bash
git add apps/dapp/app apps/dapp/src/_pages apps/dapp/src/features apps/dapp/src/entities
git commit -m "refactor(dapp): compose routes from FSD page slices"
```

### Task 7: Move Route Handlers and special UI into the App layer

**Files:**
- Move: Next Route Handler implementations → four route-specific file segments under `src/_app/*-route.ts`
- Move: `app/error.tsx` UI → `src/_app/errors/error-page.tsx`
- Move: `app/global-error.tsx` UI → `src/_app/errors/global-error-page.tsx`
- Move: `app/loading.tsx` UI → `src/shared/ui/page-loader.tsx`
- Move: metadata function bodies → `src/_app/metadata/{manifest,robots,sitemap}.ts`
- Modify: all corresponding Next entrypoints

- [ ] **Step 1: Move Route Handler logic behind the App-layer public API**

Rename handler exports to avoid collisions while leaving each function body unchanged:

```diff
// post-login-route.ts
-export const POST = async (req: NextRequest) => {
+export const postLogin = async (req: NextRequest) => {

// get-current-session-route.ts
-export const GET = async () => {
+export const getCurrentSession = async () => {

// get-health-route.ts
-const GET = async () => {
+export const getHealth = async () => {

// get-mock-route.ts
-const GET = async (request: NextRequest) => {
+export const getMock = async (request: NextRequest) => {
```

After moving the health implementation, import the workspace package metadata with:

```typescript
import pkg from '../../package.json';
```

Because these files sit directly in the App layer, each file is its own FSD segment and public API. This avoids one barrel pulling login/session dependencies into the health and mock route module graphs. From `src/_app/get-health-route.ts`, the correct package import is `../../package.json`.

`post-login-route.ts` imports `ZLoginInput` and `verifyCredentials` only from `@/features/sign-in/index.server`, `getMutableSession` only from `@/entities/session/index.server`, and shared primitives only through `@/shared/lib/logger` and `@/shared/lib/rate-limit`. `get-current-session-route.ts` calls `getPublicSession`, so the HTTP response and the RSC account payload share the same access-token-stripping projection.

- [ ] **Step 2: Replace Route Handler files with exact re-exports**

```typescript
// app/api/auth/login/route.ts
export { postLogin as POST } from '@/_app/post-login-route';

// app/api/auth/me/route.ts
export { getCurrentSession as GET } from '@/_app/get-current-session-route';

// app/api/health/route.ts
export { getHealth as GET } from '@/_app/get-health-route';
export const runtime = 'edge';

// app/api/mock/route.ts
export { getMock as GET } from '@/_app/get-mock-route';
export const runtime = 'edge';
```

Keep `runtime` statically declared for the Next.js file convention. Vinext 0.1 currently ignores this export, so isolation comes from the route-specific App segments rather than relying on an Edge-runtime split.

- [ ] **Step 3: Extract error and loading UI**

Create `src/_app/errors/index.ts`:

```typescript
'use client';

export { ErrorPage } from './error-page';
export { GlobalErrorPage } from './global-error-page';
```

Rename the moved components to named exports, preserving Sentry reporting and generic user messages:

```diff
// error-page.tsx
-function ErrorPage({
+export function ErrorPage({
-export default ErrorPage;

// global-error-page.tsx
-const GlobalError = ({
+export const GlobalErrorPage = ({
-export default GlobalError;

// page-loader.tsx
-const Loading = () => {
+export const PageLoader = () => {
-export default Loading;
```

Add `PageLoader` to `src/shared/ui/index.ts` and replace entrypoints:

```typescript
// app/error.tsx
export { ErrorPage as default } from '@/_app/errors';

// app/global-error.tsx
export { GlobalErrorPage as default } from '@/_app/errors';

// app/loading.tsx
export { PageLoader as default } from '@/shared/ui';
```

- [ ] **Step 4: Extract manifest, robots, and sitemap implementations**

Move their current function bodies to named exports `createManifest`, `createRobots`, and `createSitemap` under `_app/metadata`, and export them from `_app/metadata/index.ts`. Replace framework files with:

```typescript
export { createManifest as default } from '@/_app/metadata';
export { createRobots as default } from '@/_app/metadata';
export { createSitemap as default } from '@/_app/metadata';
```

Each snippet is used in its matching file only. Update user-facing descriptions from “vertical slice architecture” to “Feature-Sliced Design v2.1”.

- [ ] **Step 5: Run Route Handler and error-path tests**

Run:

```bash
pnpm --filter @apps/dapp exec vitest run \
  src/__test__/app/api/auth/login/route.test.ts \
  src/__test__/app/api/mock/route.test.ts
```

Expected: all status, validation, rate-limit, auth, and mock-delay cases pass through the App-layer implementations.

- [ ] **Step 6: Commit only this task if commits are requested**

```bash
git add apps/dapp/app apps/dapp/src/_app apps/dapp/src/shared/ui apps/dapp/src/__test__
git commit -m "refactor(dapp): isolate framework adapters in the FSD app layer"
```

### Task 8: Align tests, coverage, and architectural documentation

**Files:**
- Move/modify: `apps/dapp/src/__test__/**`
- Modify: `apps/dapp/vitest.config.mts`
- Modify: `apps/dapp/eslint.config.mjs`
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: Move tests so they mirror the new source architecture**

Use history-preserving moves:

```text
src/__test__/features/auth/auth.adapter.test.ts
  → src/__test__/features/sign-in/login.api.test.ts
src/__test__/server/lib/auth.test.ts
  → src/__test__/features/sign-in/verify-credentials.server.test.ts
src/__test__/features/auth/auth.action.test.ts
  → src/__test__/pages/account/logout.action.test.ts
src/__test__/features/auth/auth.server.service.test.ts
  → src/__test__/entities/session/session.server.test.ts
src/__test__/app/api/auth/login/route.test.ts
  → src/__test__/_app/post-login-route.test.ts
src/__test__/app/api/mock/route.test.ts
  → src/__test__/_app/get-mock-route.test.ts
src/__test__/shared/utils/case.helper.test.ts
  → src/__test__/shared/lib/case-conversion.test.ts
src/__test__/shared/utils/sanitize.helper.test.ts
  → src/__test__/shared/lib/url.test.ts
```

Delete `src/__test__/features/auth/auth.service.test.ts`; its only subject was the removed pass-through service. Split the old adapter test assertions so login cases import `features/sign-in/api/login.api.ts` and session cases import `entities/session/api/session.api.ts`. Tests may import the unit under test directly; production code must use slice public APIs.

- [ ] **Step 2: Update all server-only mocks with factories**

Use these boundaries:

```typescript
vi.mock('@/entities/session/index.server', () => ({
  getMutableSession: vi.fn(),
  getPublicSession: vi.fn(),
}));

vi.mock('@/features/sign-in/index.server', () => ({
  verifyCredentials: vi.fn(),
  ZLoginInput: z.object({
    email: z.email(),
    password: z.string().min(1),
  }),
}));
```

Import `z` in the Route Handler test. This follows the repo's `server-only` Vitest rule and prevents evaluation of the real module during auto-mocking.

- [ ] **Step 3: Replace obsolete coverage boundaries**

In `vitest.config.mts`, exclude framework/composition UI from coverage:

```typescript
'src/_app/**/index*.ts',
'src/_app/errors/**',
'src/_app/metadata/**',
'src/_app/providers/**',
'src/_pages/**/ui/**',
'src/shared/ui/**',
```

Replace the old service/adapter thresholds with:

```typescript
thresholds: {
  'src/features/*/{api,model}/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
  'src/entities/*/{api,model}/**': {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
},
```

- [ ] **Step 4: Replace custom dapp boundaries with the FSD import rule**

Keep the admin architecture unchanged. In `apps/dapp/eslint.config.mjs`, remove rules referring to `_components`, `_hooks`, adapters, services, and `@/server`. Retain Next/React rules and add explicit protection for framework entrypoints:

```javascript
{
  files: [
    'app/**/*.{ts,tsx}',
    'proxy.ts',
    'instrumentation.ts',
    'instrumentation-client.ts',
    'sentry.*.config.ts',
    'next.config.ts',
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '@/features/*/**',
              '@/entities/*/**',
              '@/_pages/*/**',
              '!@/_pages/*/index.server',
              '@/_app/*/**',
              '!@/_app/styles/index.css',
              '@/shared/api/**',
              '!@/shared/api/index.server',
              '@/shared/config/**',
              '@/shared/routes/**',
              '@/shared/ui/**',
              '!@/shared/ui/index.client',
              '@/shared/lib/*/**',
            ],
            message: 'Next entrypoints must consume FSD slices/segments through public APIs.',
          },
        ],
      },
    ],
  },
},
```

Steiger remains the source of truth for layer direction, slice isolation, purpose-named segments, and public-API enforcement.

- [ ] **Step 5: Rewrite the dapp architecture section in AGENTS.md**

Make the scope explicit: canonical FSD v2.1 applies to `apps/dapp`; the existing custom feature-slice layout remains scoped to `apps/admin`. Document:

```text
Next framework entrypoints (apps/dapp/app + root proxy/instrumentation)
  → _app → _pages → widgets → features → entities → shared
```

State that layers are optional, same-layer slices are isolated, `_app`/`shared` have segments rather than slices, segments are purpose-named, external consumers use public APIs, same-slice imports are relative, and server-only exports use `index.server.ts`. Replace dapp HTTP guidance with `UI → model hook → same-slice api → shared/api/xhr`; retain admin's `hook → service → adapter → apiClient` guidance. Update examples, test mocking paths, import order, and coverage language to the new structure. Preserve every existing backend Hexagonal/DDD change in `AGENTS.md`.

- [ ] **Step 6: Update README architecture claims**

Replace the dapp “vertical slice” tree with the target FSD tree, mention Steiger alongside ESLint, and explain why `widgets` is not created until a reusable/self-contained UI block exists. Update only frontend architecture copy; preserve the existing backend and local-gateway documentation changes.

- [ ] **Step 7: Run architecture and coverage gates**

Run:

```bash
pnpm --filter @apps/dapp lint:architecture
pnpm --filter @apps/dapp test:coverage
```

Expected: Steiger reports zero errors and zero warnings; coverage satisfies every 80% feature/entity threshold.

- [ ] **Step 8: Commit only this task if commits are requested**

```bash
git add AGENTS.md README.md apps/dapp/src/__test__ \
  apps/dapp/vitest.config.mts apps/dapp/eslint.config.mjs
git commit -m "docs(dapp): codify canonical Feature-Sliced Design"
```

### Task 9: Run the full definition of done

**Files:**
- Verify only; fix failures in the owning files from Tasks 1–8

- [ ] **Step 1: Confirm no legacy architecture remains**

Run:

```bash
test ! -d apps/dapp/src/app
test ! -d apps/dapp/src/server
test ! -d apps/dapp/src/features/auth
test ! -d apps/dapp/src/shared/components
test ! -d apps/dapp/src/shared/constants
test ! -d apps/dapp/src/shared/schemas
test ! -d apps/dapp/src/shared/stores
test ! -d apps/dapp/src/shared/types
test ! -d apps/dapp/src/shared/utils
rg -n "@/features/.+/(api|model|ui)|@/entities/.+/(api|model|ui)|@/server|shared/(components|constants|schemas|stores|types|utils)" \
  apps/dapp/app apps/dapp/src \
  --glob '!src/__test__/**' --glob '!src/styled-system/**'
```

Expected: every `test` exits 0 and `rg` has no production-code matches.

- [ ] **Step 2: Run the dapp-focused gates first**

```bash
pnpm --filter @apps/dapp typecheck
pnpm --filter @apps/dapp lint
pnpm --filter @apps/dapp test
pnpm --filter @apps/dapp build
```

Expected: all four commands pass.

- [ ] **Step 3: Run the repo-wide gates required by AGENTS.md**

```bash
pnpm typecheck
pnpm check:ci
pnpm lint
pnpm test
pnpm build
```

Expected: zero type, format, lint, test, or build failures. If an unrelated pre-existing dirty-worktree failure occurs, record the exact command and failure without overwriting the user's changes.

- [ ] **Step 4: Inspect the final diff and FSD graph**

Run:

```bash
git status --short
git diff --stat
git diff -- apps/dapp AGENTS.md README.md pnpm-lock.yaml
pnpm --filter @apps/dapp lint:architecture
```

Expected: the diff contains only the planned dapp architecture migration plus the narrow AGENTS/README updates; Steiger again reports zero errors and zero warnings.

- [ ] **Step 5: Commit the final fixes only if commits are requested**

```bash
git add apps/dapp AGENTS.md README.md pnpm-lock.yaml
git commit -m "refactor(dapp): adopt Feature-Sliced Design"
```

## Self-review

- **Spec coverage:** The plan addresses every observed violation: Next/FSD folder collision, missing `_pages` and `entities`, oversized domain-based auth slice, nonstandard segment names, missing public APIs, deep imports, server/client public API mixing, and absent automated architecture enforcement.
- **YAGNI:** No empty layer folders are created. `widgets` is omitted, sign-out remains page-local, and the one-line auth service is deleted.
- **Runtime safety:** Next static exports (`runtime`, proxy `config`) remain in framework entrypoints. Server-only APIs use factories in Vitest and `index.server.ts` in production.
- **Change safety:** The plan preserves current routes, cookie schema, API response shapes, form behavior, CSP, Sentry, Panda scanning, and deployment rules. The only intentional visible text change replaces “vertical slice architecture” with “Feature-Sliced Design”.
- **Dirty worktree safety:** Every task scopes staging and explicitly preserves the user's unrelated backend/CI/documentation changes.
