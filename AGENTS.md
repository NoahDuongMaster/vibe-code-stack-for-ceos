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
| `apps/dapp` | `@apps/dapp` | Next.js 16 App Router (vinext/Vite) | Cloudflare Workers |
| `apps/admin` | `@apps/admin` | React 19 SPA (Rsbuild + React Router, no RSC) | Cloudflare Pages |
| `apps/landing` | `@apps/landing` | Astro static site (zero JS by default) | Cloudflare Workers |
| `services/trading-rpc` | `@services/trading-rpc` | Connect-RPC server on Fastify/HTTP2 (Connect + gRPC + gRPC-Web; tsup) | Docker |
| `services/api-gateway` | `@services/api-gateway` | Edge gateway Worker (Hono: request-id, CORS, self-hosted Durable Object rate-limit, opt-in JWT auth, upstream proxy) | Cloudflare Workers |
| `packages/protocol` | `@packages/protocol` | Protobuf schemas, buf codegen → `src/gen/` | — |
| `packages/api-core` | `@packages/api-core` | Shared RPC impl + CORS-aware fetch handler | — |
| `packages/api-client` | `@packages/api-client` | Typed Connect-RPC browser client | — |

Rule scope: Server/Client Component rules apply to `apps/dapp` only. Canonical
Feature-Sliced Design v2.1 applies to all three frontend apps, with
framework-specific entrypoints documented below. The backend slice architecture
applies to `packages/api-core` + `services/*` (see Architecture rules).
Everything else (naming, testing, git, security) applies repo-wide.

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
| API server (Node) | Fastify 5 + `@connectrpc/connect-fastify` (HTTP/2, gRPC) · edge gateway on Hono 4 |
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

pnpm --filter @apps/dapp test                                   # one workspace
pnpm --filter @apps/dapp exec vitest run <path-to-test-file>    # one test file
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

### Dapp architecture — canonical Feature-Sliced Design v2.1

Next.js framework entrypoints stay outside the FSD root. They are thin adapters
that delegate to the appropriate App or Page public API:

```text
apps/dapp/
  app/                         Next pages/layout/Route Handlers only
  proxy.ts                     Next proxy entrypoint only
  instrumentation*.ts          Next instrumentation entrypoints only
  src/
    _app/                      App-layer segments: routes, providers, metadata,
                               errors, proxy, instrumentation, styles
    _pages/{home,sign-in,account,not-found}/
                               complete screens; api/model/ui + public API
    features/sign-in/          reusable sign-in interaction; api/model/ui
    entities/session/          session domain API/model + client/server APIs
    shared/                    api, config, focused lib/*, routes, ui
    styled-system/             generated Panda code; never hand-edit
```

Conceptual dependency direction is one-way:

```text
Next framework entrypoints → _app → _pages → widgets → features → entities → shared
```

Layers are optional. `widgets` is intentionally absent until a reusable,
self-contained UI block exists. `_app` and `shared` contain segments rather than
slices. The underscore prefixes prevent collisions with Next's root `app/` and
legacy Pages Router while preserving the canonical layer roles.

1. Imports point downward only. Same-layer slices are isolated and MUST NOT
   import each other.
2. Every slice and every `_app`/`shared` segment exposes a Public API. External
   consumers never deep-import internals; imports inside one slice are relative.
3. Server-only exports use `index.server.ts`; client-only exports use
   `index.client.ts`. Never mix a `server-only` module into a client API.
4. Segments are purpose-named (`api`, `model`, `ui`, `config`), never
   essence-named (`components`, `hooks`, `types`, `services`, `utils`). Focused
   Shared libraries live under `shared/lib/[purpose]/index.ts`.
5. `app/`, root proxy, and root instrumentation files contain only framework
   contracts, static Next exports, and public-API delegation—zero business logic.
6. Steiger enforces standard FSD layers/public APIs; ESLint covers the
   underscored Next compatibility layers and framework entrypoints. Run
   `pnpm --filter @apps/dapp lint:architecture` after structural changes.
7. `src/styled-system/**` is generated Panda code and the only top-level FSD
   exception. Never hand-edit it.
8. Monorepo boundaries remain: `packages/` → `packages/` only; `services/` →
   `packages/` only; nothing imports from `apps/`.

### Admin architecture — canonical Feature-Sliced Design v2.1

`apps/admin` uses the standard FSD layers and purpose-named segments:

```text
src/
  app/                    entrypoint, providers, router, global styles
  pages/[name]/           complete route screens; api/model/ui + index.ts
  widgets/app-shell/      reusable protected-route layout
  features/[action]/      reusable product interactions (currently absent)
  entities/{session,user}/ domain models, data access, queries + index.ts
  shared/                 api, config, focused lib/*, model, routes, ui
```

Dependency direction is strictly downward: `app → pages → widgets → features →
entities → shared`. Layers are optional: admin currently has no `features/`
because sign-in, create-user, and service-health are each used by only one page
and therefore belong to those Page slices. Do not create a layer or slice merely
to make the folder tree look complete.

1. Slices on the same layer are isolated and MUST NOT import each other.
2. Every slice and every `app`/`shared` segment exposes a Public API (`index.ts`);
   external consumers never deep-import internals. Same-slice imports are
   relative.
3. Segment names describe purpose (`ui`, `api`, `model`, `config`), never file
   essence (`components`, `hooks`, `types`, `services`, `utils`). Focused Shared
   libraries use `shared/lib/[purpose]/index.ts`.
4. `app/router` only composes Page and Widget Public APIs. Route screens and
   page-specific data/UI live in `pages/[name]`, not in `app`.
5. Add an Entity for a business noun reused by higher layers. Add a Feature only
   for a meaningful interaction reused across pages or independently consumed.
6. Steiger is the source of truth for FSD direction, slice isolation, segment
   names, and Public APIs. Run
   `pnpm --filter @apps/admin lint:architecture` after structural changes.
7. `src/styled-system/**` is generated Panda code and the only top-level FSD
   exception. Never hand-edit it.

### Landing architecture — canonical Feature-Sliced Design v2.1

`apps/landing` uses Astro route entrypoints in `astro/pages/` and canonical FSD
application code in `src/`. Its current layers are `app → pages → widgets →
shared`; `features` and `entities` are intentionally absent until the product
has reusable user interactions or domain entities.

1. Imports point downward only. Slices on the same layer never import each other.
2. Every slice and every `app`/`shared` segment exposes an `index.ts` Public API;
   external consumers never deep-import internals.
3. Segment names describe purpose (`ui`, `model`, `config`, `seo`, `styles`),
   never file essence (`components`, `hooks`, `types`, `data`).
4. `astro/pages/` contains thin framework entrypoints only. Page composition
   lives in `src/pages/[name]`; independent page blocks live in `src/widgets`.
5. A static section describing product features is a widget, not an FSD feature.
   Add an FSD feature only for a reusable user interaction that provides value.
6. Run `pnpm --filter @apps/landing lint:architecture` after structural changes.

### Backend architecture — Hexagonal (Ports & Adapters) + Vertical Slice

The backend follows **Hexagonal architecture** (a.k.a. Ports & Adapters). The
domain is an isolated core that knows nothing about transport or infrastructure;
the outside world plugs in through adapters. This is NOT the frontend's pattern —
it's the backend's own standard, adapted to Connect-RPC.

| Hexagon ring | This repo |
|--------------|-----------|
| **Contract** (ports) | `packages/protocol` — the proto service/method definitions |
| **Shared application core** | `packages/api-core` — transport-neutral shared RPC slices |
| **Service-local core** | `services/*/src/{domain,application}` — tactical DDD models, ports, and use cases |
| **Driving / inbound adapters** | `services/*` — Node http (`trading-rpc`), CF edge (`api-gateway`) |
| **Driven / outbound adapters** | `services/*/src/infra` — repositories and runtime/provider adapters behind ports |

**The Dependency Rule** — imports point inward only. Across workspaces:
`services/* → api-core → protocol`. Inside a service: `index/config →
adapters/infra → application → domain`; domain imports no outer layer,
application imports no transport/runtime, and adapters depend on ports rather
than the reverse. The monorepo boundary (`services/` → `packages/` only)
enforces the outer half.

**Application core (`packages/api-core`) — vertical slices inside the hexagon:**

```
packages/api-core/src/
  features/[domain]/          one slice per RPC domain (echo, health, …)
    [domain].schema.ts        Zod validation at the RPC trust boundary + types
    [domain].service.ts       use-case / business logic — transport-agnostic, pure, tested
    [domain].handler.ts       inbound port: binds the Connect method → service
    [domain].repository.ts     (add when persistence exists) outbound port — data access behind an interface
    index.ts                  PUBLIC slice barrel — the ONLY import surface
  shared/                     cross-cutting: cors, errors, config. Zero business logic.
  runtime/                    createRoutes (composes slices) + createFetchHandler
  index.ts                    PUBLIC package barrel — the ONLY surface adapters import
```

**Driving adapters (`services/*`) — three internal roles, expressed by folder.**
`index.ts` = composition root; `adapters/` = inbound adapters; `infra/` =
infrastructure. A very small service MAY keep a role as a single flat file, but
grow it into the matching folder — never a flat pile of unrelated files.

```
services/trading-rpc/src/               (Node driving adapter — Fastify / HTTP2)
  index.ts                COMPOSITION ROOT — validates env, inits Sentry, builds the
                          server, wires graceful shutdown. The ONLY place env is read.
  adapters/http.adapter.ts INBOUND ADAPTER — Fastify (HTTP/2) hosting api-core routes via
                          @connectrpc/connect-fastify (Connect + gRPC + gRPC-Web, streaming);
                          CORS, rate-limit, body cap, logging are Fastify plugins.

services/api-gateway/src/               (Cloudflare edge driving adapter)
  index.ts                COMPOSITION ROOT — the only dependency-wiring surface;
                          exports the Worker and the Durable Object class.
  domain/                 TACTICAL DDD — policies/value objects/aggregate roots:
    access-control/       public-route policy.
    rate-limiting/        ClientIdentifier + RateLimitPolicy value objects,
                          TokenBucket aggregate, repository port, domain errors.
    routing/              typed upstream routing errors.
  application/            INPUT/OUTPUT PORTS + USE CASES — authorize request,
                          enforce rate limit, route RPC, consume bucket token.
  adapters/http/          INBOUND ADAPTER — Hono composition, middleware,
                          handlers, HTTP error mapping; zero business logic.
  adapters/cloudflare/    Cloudflare binding types at the runtime boundary.
  infra/                  DRIVEN ADAPTERS — Hono JWT, console logging, api-core,
                          VPC/local RPC proxy, DO repository + RPC class.
  config/                 validated runtime config + operational policy values.
```

Hard rules (convention today — services lint with Biome, which lacks the FE's
ESLint boundary rules, so these are review-enforced):

1. **Handlers** (inbound ports) hold ZERO business logic — validate input, call
   the service, map the result to the proto response. Only handlers import
   Connect/proto types.
2. **Application use cases** own orchestration, depend only on domain models and
   ports, contain no Hono/Connect/Cloudflare imports, and are unit-tested
   (target ≥ 80%).
3. **Repositories** (outbound ports) isolate data access behind an interface;
   services depend on the interface, never a concrete client. (No persistence
   yet — the slot is defined for when it arrives.)
4. Validate ALL external input with **Zod at the handler boundary** (`Z`-prefixed
   schema; proto gives structural types, Zod gives semantic ones).
5. Services throw typed domain errors. Connect handlers map them via
   `toConnectError`; HTTP adapters map them to safe status/envelopes — never leak
   internals to the client.
6. One-way deps inside `api-core`: `runtime/ → features/[domain]/index.ts →
   shared/`. One-way deps inside service-local cores: `application → domain`.
   Domain/application MUST NOT import `adapters`, `infra`, Hono, Connect, or
   Cloudflare runtime modules. Import api-core only via its root barrel.
7. **Adapters (`services/*`) are THIN** — they translate a runtime (Node http /
   CF fetch) into api-core calls and back, and MUST NOT contain business logic.
   Env/secrets are read ONLY in the composition root. Reuse api-core's shared
   helpers (e.g. `isOriginAllowed`) instead of re-implementing them.

### HTTP layer

- Components MUST NOT call `fetch()`/axios.
- `apps/dapp` data flows UI → model hook → same-slice `api/` → `xhr` from
  `@/shared/api` (ofetch, `credentials: 'include'`, no baseURL; same-origin
  `app/api/**` BFF paths resolve as-is; external APIs use
  `xhr.create({ baseURL })`).
- `apps/admin` slice `api/` modules use `apiClient` from `@/shared/api`
  (Connect-RPC client with the auth interceptor pre-wired). Only
  `shared/api/api-client.ts` may call `createApiClient` directly.

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
| Default export | ONLY `page.tsx`, `layout.tsx`, `not-found.tsx`; framework-native `.astro` component exports are also allowed | — |

## Code patterns

```typescript
// features/sign-in/model/login.schema.ts — schema first, type derived
export const ZLoginInput = z.object({
  email: z.email(),
  password: z.string().min(1),
})
export type TLoginInput = z.infer<typeof ZLoginInput>

// features/sign-in/api/login.api.ts — same-slice I/O through Shared
export const login = (input: TLoginInput): Promise<void> =>
  xhr(API_ROUTES.AUTH_LOGIN, { method: 'POST', body: input })

// features/sign-in/model/use-login.ts — model orchestrates its slice API
export const useLogin = () => useMutation({ mutationFn: login })

// features/sign-in/index.ts — minimal client public API
export { LoginForm } from './ui/login-form'

// features/sign-in/index.server.ts — separate server-only public API
import 'server-only'
export { verifyCredentials } from './model/verify-credentials.server'
```

Import order: React/Next → external packages → `@/shared/*` → `@/entities/*` →
`@/features/*` → `@/widgets/*` → `@/_pages/*` → `@/_app/*` → relative →
styles. `import type` last.

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
  env module (`apps/dapp/src/shared/config/env.ts`,
  `apps/admin/src/shared/config/env.ts`). Document new vars in the app's
  `.env.sample`.
- Validate ALL external input with Zod at trust boundaries (server actions,
  route handlers, RPC handlers).
- Server modules use `import 'server-only'`.
- CSP: dapp builds a nonce-based CSP in `src/_app/proxy/proxy.ts`, delegated by
  root `proxy.ts` — the nonce and CSP MUST be set on request headers (not only
  the response). Admin/landing ship static headers via `public/_headers`.
- Backend CORS is allowlist-driven via `CORS_ORIGINS` (handled in
  `packages/api-core` and `services/trading-rpc`).
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

- Dapp and admin tests mirror FSD paths, import the unit under test directly,
  and mock only the lower-layer I/O boundary when isolation is needed.
- Any mock of `index.server.ts` MUST use a factory so Vitest does not evaluate
  the real `server-only` graph first.
- Mock env config where needed:
  `vi.mock('@/shared/config', () => ({ env: { ... } }))`.
- Naming: `describe('[ServiceName]')` > `it('should [behavior] when [condition]')`.
- Test behavior/outcomes, never implementation details. Coverage target ≥ 80%
  for feature/entity `api` and `model` logic.

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

- `infras/docker` is the single source of truth for all Dockerfiles and Compose
  configuration. Workspaces MUST NOT contain their own Dockerfiles. Keep one
  Dockerfile per deployable image and environment differences in Compose
  overlays; run `make check-docker` after changes.
- All deploys are CI-driven via `.github/workflows/deploy.yml`, gated on a
  green CI run: push to `develop` → staging; push to `main` → production
  (behind a required manual approval in the GitHub `production` Environment).
  NEVER run `wrangler deploy` / `pnpm deploy:*` from a local machine.
- Cloudflare targets use `wrangler.jsonc` `env.staging` / `env.production`
  blocks with distinct worker names — deploys MUST pass an explicit
  `--env staging|production`.
- Rollback: `wrangler rollback --env production` (Workers keep prior versions).
- `services/trading-rpc` builds a Docker image (`infras/docker/trading-rpc.Dockerfile`,
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
  (regenerate with `pnpm --filter @packages/protocol generate`) and
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
| `fetch()`/axios in a component | model hook + same-slice API |
| Raw `fetch()` in API modules | `@/shared/api` (dapp) / `@/shared/api` client (admin) |
| `'use client'` on `layout.tsx` | Server Component always |
| `useState` for form fields | react-hook-form |
| `console.log` | `logger` from `@/shared/lib/logger` |
| Hardcoded URLs | `API_ROUTES` / `WEB_ROUTES` from `@/shared/routes` |
| Deep slice imports from another slice/framework file | the slice Public API |
| Cross-slice imports on the same layer | compose above or extract downward |
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
