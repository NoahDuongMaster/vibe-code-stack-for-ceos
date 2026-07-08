# AGENTS.md — Vibe Code Stack For CEOs

AI-first Turborepo monorepo (pnpm 11, Node 22, TypeScript strict): 3 frontend
apps + 2 backend services + 3 shared packages, deployed to Cloudflare.

- This file is the single source of truth for agent behavior. `CLAUDE.md` is a
  symlink to it — always edit `AGENTS.md`.
- This is intentionally the ONLY `AGENTS.md` in the repo (no nested
  per-workspace files) — rules are scoped per workspace inside this file to
  avoid drift. Don't create nested agent files.
- When a rule here conflicts with existing code, follow the rule and flag the
  code.

## Monorepo map

| Workspace | Package | What it is | Deploys to |
|-----------|---------|------------|------------|
| `apps/dapp` | `@repo/web` | Next.js 16 App Router (vinext/Vite) | Cloudflare Workers |
| `apps/admin` | `@repo/admin` | React 19 SPA (Rsbuild + React Router, no RSC) | Cloudflare Pages |
| `apps/landing` | `@repo/landing` | Astro static site (zero JS by default) | Cloudflare Workers |
| `services/api-node` | `@repo/api-node` | Connect-RPC Node server (tsup, Dockerfile) | Docker |
| `services/api-gateway` | `@repo/gateway-cf` | Edge gateway Worker (CORS, upstream proxy) | Cloudflare Workers |
| `packages/protocol` | `@repo/protocol` | Protobuf schemas, buf codegen → `src/gen/` | — |
| `packages/api-core` | `@repo/api-core` | Shared RPC impl + CORS-aware fetch handler | — |
| `packages/api-client` | `@repo/api-client` | Typed Connect-RPC browser client | — |

Rule scope: Server/Client Component rules apply to `apps/dapp` only. The
feature-slice architecture applies to `apps/dapp` and `apps/admin`. Everything
else (naming, testing, git, security) applies repo-wide.

## Tech stack (mind the major versions — APIs differ across generations)

| Layer | Tool + version |
|-------|----------------|
| Framework (dapp) | Next.js 16 App Router on vinext 0.1 (Vite) |
| UI | React 19 · Panda CSS 1.x + Ark UI 5 (headless) |
| Language | TypeScript 6, `strict: true` |
| Validation | Zod **4** (not v3 — different error/message APIs) |
| Server state | TanStack Query 5 |
| Client/URL state | Zustand 5 · nuqs 2 |
| Forms | react-hook-form 7 + Zod resolver |
| Server actions | next-safe-action **8** |
| Tables | TanStack Table 8 |
| HTTP | ofetch 1 (via shared `xhr`) · Connect-RPC 2 (`@connectrpc/*`) |
| Auth | iron-session 8 (encrypted cookies) |
| Admin | Rsbuild 2 (Rspack) · React Router **7** |
| Landing | Astro 7 |
| Testing | Vitest 4 + Testing Library + MSW 2 + Playwright |
| Lint/format | Biome 2 + ESLint 9 (flat config) + buf |
| Monorepo | Turborepo 2 + pnpm 11 workspaces |

## Commands

```bash
pnpm install                  # pnpm only (enforced); Node >= 22 (engine-strict)

pnpm dev                      # all apps
pnpm dev:web | dev:admin | dev:landing | dev:api    # one app

pnpm typecheck                # tsc --noEmit, all 8 workspaces
pnpm check:ci                 # Biome (read-only), whole repo
pnpm lint                     # ESLint (apps) / Biome (services) / buf lint (protocol)
pnpm test                     # Vitest, all workspaces
pnpm build                    # production builds
pnpm check                    # Biome auto-fix + format

pnpm --filter @repo/web test                                   # one workspace
pnpm --filter @repo/web exec vitest run <path-to-test-file>    # one test file
pnpm test:e2e                 # Playwright (apps/dapp/e2e/); needs browsers installed
```

## Definition of done

Run these before declaring any task complete. CI runs exactly the same gates.

- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm check:ci` — zero errors
- [ ] `pnpm lint` — zero errors
- [ ] `pnpm test` — all pass; new logic has tests
- [ ] `pnpm build` — if you touched build-relevant code or config

Deploys are CI-gated only (`.github/workflows/deploy.yml`; `develop` → staging,
`main` → production). NEVER deploy from a local machine.

## Architecture rules

### Feature-slice layout (`apps/dapp`, `apps/admin`)

```
src/
  app/             Routes ONLY — pages, layouts, API route handlers. Zero business logic.
  features/[name]/
    _components/   Private UI — MUST NOT be imported outside the feature
    _hooks/        Private hooks — same restriction
    adapters/      HTTP layer (see below)
    schemas/       Zod schemas + derived types
    services/      Business logic — orchestrates adapters
    actions/       next-safe-action server actions (dapp only)
    index.ts       PUBLIC barrel — the ONLY import surface for other layers
  shared/          Cross-cutting utilities. Zero business logic.
  server/          Server-only (dapp only) — 'server-only' guarded
```

Dependency direction (one-way): `app/ → features/[name]/index.ts → shared/`;
`server/lib` may be used by features' server code, never by Client Components.

### Hard rules (ESLint-enforced — violations fail `pnpm lint`)

1. `app/` MUST import features only via `@/features/[name]` (or
   `@/features/[name]/server` for dapp server-only entry points). Never deep
   paths.
2. Features MUST NOT import other features. Extract shared logic to `shared/`.
3. `_components/` and `_hooks/` are private to their feature.
4. `shared/` MUST NOT import from `features/` or `app/`.
5. `server/` MUST NOT be imported in Client Components or `shared/`.
6. Monorepo boundaries: `packages/` → `packages/` only; `services/` →
   `packages/` only; nothing imports from `apps/`.

### HTTP layer

- Components MUST NOT call `fetch()`/axios — data flows component → TanStack
  Query hook → service → adapter.
- `apps/dapp` adapters: use `xhr` from `@/shared/lib/xhr` (ofetch,
  `credentials: 'include'`, no baseURL; same-origin `app/api/**` BFF paths
  resolve as-is; external APIs: `xhr.create({ baseURL })`).
- `apps/admin` adapters: use `apiClient` from `@/shared/lib/api-client`
  (Connect-RPC client with the auth interceptor pre-wired). Never call
  `createApiClient` directly.

### Server vs Client Components (`apps/dapp` only)

- Default is a Server Component. Add `'use client'` ONLY for `useState`,
  `useEffect`, `useRef`, event handlers, `useQuery`, or `window`/`document`.
- NEVER `'use client'` on `layout.tsx`. Push the directive as deep as possible.
- Fetch data in Server Components when possible (e.g. read iron-session
  server-side instead of a client fetch).

## Naming conventions

| Thing | Convention | Example |
|-------|------------|---------|
| Component file | kebab-case | `user-profile.tsx` |
| Component export | PascalCase | `export function UserProfile()` |
| Hook file | `use-` + kebab | `use-user-profile.ts` |
| Zod schema | `Z` prefix | `const ZUser = z.object(...)` |
| Type (derived or re-exported) | `T` prefix | `type TUser = z.infer<typeof ZUser>` |
| Constant | SCREAMING_SNAKE | `API_ROUTES.GET_USER` |
| Zustand store | `use` + Name + `Store` | `useUserStore` |
| Service | camelCase + `Service` | `userService` |
| Default export | ONLY `page.tsx`, `layout.tsx`, `not-found.tsx` | — |

## Code patterns

```typescript
// schemas/user.schema.ts — schema first, type derived
export const ZUser = z.object({ id: z.string().uuid(), name: z.string().min(1) })
export type TUser = z.infer<typeof ZUser>

// adapters/user.adapter.ts (dapp) — xhr + typed domain errors
export const getUserAPI = async (id: string): Promise<TUser> => {
  try { return await xhr<TUser>(API_ROUTES.GET_USER(id)) }
  catch (error) { throw toUserError(error) }   // never leak FetchError upward
}

// adapters/health.adapter.ts (admin) — shared Connect-RPC client
export const getHealthAPI = (): Promise<THealthResponse> => apiClient.health({})

// services/user.service.ts — orchestrates adapters, owns business logic
export const userService = { async getUser(id: string) { return getUserAPI(id) } }

// index.ts — public barrel, exports only what outsiders need
export { userService } from './services/user.service'
export type { TUser } from './schemas/user.schema'
```

Import order: React/Next → external packages → `@/shared/*` → `@/features/*`
→ `@/server/*` → relative → styles. `import type` last.

## Error handling

- Error boundaries (`error.tsx` per dapp route segment; router `errorElement`
  in admin) MUST report via `Sentry.captureException` and show a generic
  message — NEVER render raw `error.message`.
- Services throw typed domain errors; adapters map HTTP errors to them.
- Server Actions return `{ success, data?, error? }` — never throw, never echo
  internal error text to the browser.
- NEVER swallow errors — log via `logger`, then re-throw or return error state.
  Failed queries in lists/tables show an error + retry, not an empty state.
- 404s: `notFound()` from `next/navigation` — never return null UI.

## Security

- NEVER read `process.env.X` / `import.meta.env.X` directly — use the validated
  env module (`apps/dapp/src/shared/config/env.configuration.ts`,
  `apps/admin/src/shared/config/env.ts`). Document new vars in the app's
  `.env.sample`.
- Validate ALL external input with Zod at trust boundaries (server actions,
  route handlers, RPC handlers).
- Server modules use `import 'server-only'`.
- CSP: dapp builds a nonce-based CSP in `src/proxy.ts` — the nonce and CSP MUST
  be set on the request headers (not only the response). Admin/landing ship
  static headers via `public/_headers`.
- Backend CORS is allowlist-driven via `CORS_ORIGINS` (handled in
  `packages/api-core` and `services/api-node`).
- NEVER: committed secrets, `eval()`, `new Function()`,
  `dangerouslySetInnerHTML` without DOMPurify.

## Performance & accessibility

- dapp images: `next/image` with explicit dimensions — never raw `<img>`.
- Code-split at route level (`React.lazy` in admin; `next/dynamic` +
  `{ ssr: false }` for heavy below-the-fold dapp components).
- No barrel re-exports that break tree-shaking — `export type` separately.
- WCAG 2.2 AA: semantic HTML (never `<div>` + onClick), keyboard navigation,
  meaningful `alt`, a visible `<label>` or `aria-label` per input, contrast
  ≥ 4.5:1. Ark UI handles a11y — don't override `aria-*` without reason.

## Testing

| Workspace | Test location |
|-----------|---------------|
| `apps/dapp` unit | `src/__test__/**` (mirrors `src/`) |
| `apps/dapp` E2E | `e2e/*.test.ts` (Playwright; fixtures in `e2e/fixtures/base.ts`) |
| `apps/admin` unit | `src/__test__/**` (mirrors `src/`) |
| `services/*`, `packages/*` | colocated `src/*.test.ts` |

- Mock adapters with `vi.mock('@/features/[name]/adapters/[name].adapter')` —
  NEVER mock services.
- Mock env config where needed:
  `vi.mock('@/shared/config/env.configuration', () => ({ env: { ... } }))`.
- Naming: `describe('[ServiceName]')` > `it('should [behavior] when [condition]')`.
- Test behavior/outcomes, never implementation details. Coverage target ≥ 80%
  for services and adapters.

## Git & PRs

Enforced by husky hooks (`.husky/validate-commit.sh`, `validate-branch.sh`) —
off-format commits/branches are rejected locally.

- Commit header (Conventional Commits): `type(scope)[!]: description`
  - Types: `build|chore|ci|docs|feat|fix|hotfix|perf|refactor|release|revert|style|test`
  - Scope: optional, lowercase — use the workspace or area you touched, e.g.
    `(dapp)`, `(admin)`, `(landing)`, `(api-node)`, `(gateway)`, `(protocol)`, `(infra)`
  - `!` after type/scope marks a breaking change
  - Keep the header ≤ 100 chars (soft limit — hook only warns)
  - `Merge/Revert/fixup!/squash!` headers bypass validation
  - Examples: `feat(dapp): add user profile page` ·
    `fix(api-node): handle empty echo payload` ·
    `refactor!: drop the legacy RPC client`
- Branch: `type(scope)/short-kebab-description` — lowercase kebab; scope
  optional. Examples: `feat(dapp)/user-profile`, `chore/upgrade-turborepo`.
  Exempt: `main|develop|staging|release/*|hotfix/*|dependabot/*|renovate/*`.
- PR: title follows the commit convention; body has Summary, Test plan,
  Breaking changes.
- Versioning/changelogs are automated (release-please manifest mode) — NEVER
  hand-edit `CHANGELOG.md` or `version` fields.

## Deployment

- All deploys are CI-driven via `.github/workflows/deploy.yml`, gated on a
  green CI run: push to `develop` → staging; push to `main` → production
  (behind a required manual approval in the GitHub `production` Environment).
  NEVER run `wrangler deploy` / `pnpm deploy:*` from a local machine.
- Cloudflare targets use `wrangler.jsonc` `env.staging` / `env.production`
  blocks with distinct worker names — deploys MUST pass an explicit
  `--env staging|production`.
- Rollback: `wrangler rollback --env production` (Workers keep prior versions).
- `services/api-node` builds a Docker image (`services/api-node/Dockerfile`,
  multi-stage, non-root, `/healthz` healthcheck) — hosting platform not chosen
  yet, so it is not wired into `deploy.yml`.
- Secrets are provisioned per environment via GitHub Environment
  secrets/vars and `wrangler secret put` — never committed, never in
  `wrangler.jsonc` `vars`.

## Gotchas (read before debugging)

- **`server-only` under Vitest**: the package throws when imported outside RSC.
  It is globally mocked in dapp test setup; a `vi.mock` of any module that
  imports it MUST provide a factory (auto-mocks still evaluate the real module
  first).
- **Turbo strict env mode**: a new build-time env var MUST be added to the
  `build.env` allowlist in `turbo.json`, or it is silently stripped from the
  build AND excluded from the cache key.
- **Generated code — never hand-edit**: `packages/protocol/src/gen/**`
  (regenerate with `pnpm --filter @repo/protocol generate`) and
  `apps/*/src/styled-system/**` (Panda CSS, regenerated by `prepare`).
- **`wrangler.jsonc` files are JSONC** — comments are allowed and load-bearing;
  don't "fix" them into plain JSON.
- **Dependency overrides** live in `pnpm-workspace.yaml` (`overrides:`), not in
  `package.json` — pnpm 11 ignores the `package.json` `pnpm` field.
- **dapp reads `.env` at build time** — `.env*` files are part of turbo's build
  inputs; changing one invalidates the cache (by design).

## Anti-patterns

| ❌ Never | ✅ Instead |
|---------|-----------|
| `fetch()`/axios in a component | TanStack Query hook + service |
| Raw `fetch()` in adapters | `shared/lib/xhr` (dapp) / `shared/lib/api-client` (admin) |
| `'use client'` on `layout.tsx` | Server Component always |
| `useState` for form fields | react-hook-form |
| `console.log` | `logger` from `@/shared/utils/logger.helper` |
| Hardcoded URLs | `API_ROUTES` / `WEB_ROUTES` from `@/shared/constants/routes.constant` |
| Deep feature imports in `app/` | the feature's `index.ts` barrel |
| Cross-feature imports | extract to `shared/` |
| `any` / `as any` | `unknown` + type guard |
| `process.env.X` directly | validated env config module |
| Default export on non-page files | named exports |

## MCP tools (when available)

- **code-review-graph** — use before reading raw files:
  `semantic_search_nodes` (find symbols), `get_impact_radius` (blast radius
  before refactoring), `detect_changes` (staged-change risk),
  `query_graph pattern="callers_of"` (find callers).
- **Context7** — current library docs: `resolve_library_id` →
  `get_library_docs` (prefer over stale training data).
