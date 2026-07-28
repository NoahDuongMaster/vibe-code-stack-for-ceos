# AGENTS.md — Vibe Code Stack For CEOs

AI-first Turborepo monorepo (pnpm 11, Node 22, TypeScript strict): 3 frontend
apps + 3 backend services + 3 shared packages, deployed to Cloudflare and
private AWS EC2 infrastructure.

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
| `services/trading-rpc` | `@services/trading-rpc` | NestJS host on Fastify: Connect for edge + native Nest gRPC for Node services | AWS EC2 (Docker/ECR/SSM) |
| `services/admin-rpc` | `@services/admin-rpc` | Admin-facing NestJS RPC facade; calls trading-rpc over native gRPC for coin data | AWS EC2 (Docker/ECR/SSM) |
| `services/api-gateway` | `@services/api-gateway` | Edge gateway Worker (Hono: request-id, CORS, self-hosted Durable Object rate-limit, opt-in JWT auth, upstream proxy) | Cloudflare Workers |
| `packages/protocol` | `@packages/protocol` | Protobuf schemas, buf codegen → `src/gen/` | — |
| `packages/api-core` | `@packages/api-core` | Shared RPC impl + CORS-aware fetch handler | — |
| `packages/api-client` | `@packages/api-client` | Typed Connect-RPC browser client | — |

Rule scope: Server/Client Component rules apply to `apps/dapp` only. All three
frontend apps use an FSD-inspired layered architecture with explicit
`bootstrap`/`screens` names and framework-specific entrypoints documented below.
The backend slice architecture applies to `packages/api-core` + `services/*`
(see Architecture rules).
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
| API server (Node) | NestJS 11 + Fastify 5 + ConnectRPC 2 + native Nest gRPC · edge gateway on Hono 4 |
| Database | PostgreSQL 18 · Drizzle ORM 0.45 + Drizzle Kit 0.31 on node-postgres 8 |
| Auth | iron-session 8 (encrypted cookies) |
| Admin | Rsbuild 2 (Rspack) · React Router **7** |
| Landing | Astro 7 |
| Testing | Vitest 4 + Testing Library + MSW 2 + Playwright |
| Lint/format | Biome 2 + ESLint 10 (flat config) + buf |
| Monorepo | Turborepo 2 + pnpm 11 workspaces |

## Commands

```bash
mise run setup                # install locked tools + frozen dependencies

mise run dev                  # native apps + managed PostgreSQL/VPC infra
mise run dev:web | dev:admin | dev:landing          # one frontend
mise run dev:api | dev:admin-api | dev:gateway | dev:backend  # backend topology
mise run dev:infra:stop       # stop native-development Docker infra

mise run typecheck            # tsc --noEmit, all 9 workspaces
mise run check:ci             # Biome (read-only), whole repo
mise run lint                 # ESLint / Biome / buf / architecture checks
mise run test                 # toolchain tests + Vitest, all workspaces
mise run test:coverage        # enforce dapp/admin logic coverage thresholds
mise run build                # production builds
mise run check                # Biome auto-fix + format
mise run verify               # all definition-of-done gates, sequentially
mise run test:docker          # Docker builds + PostgreSQL backup/restore integration
mise run test:protocol        # codegen drift + protobuf breaking check
mise run security:audit       # high-severity dependency audit

mise run docker:start             # full Docker development stack
mise run docker:start:dapp | docker:start:admin | docker:start:landing
mise run docker:start:api-gateway | docker:start:admin-rpc | docker:start:trading-rpc
mise run docker:stop | docker:check
mise run terraform:check       # fmt + provider-backed validate; never apply

# pnpm is internal; use it directly only for targeted commands without a mise task.
pnpm --filter @apps/dapp test                                   # one workspace
pnpm --filter @apps/dapp exec vitest run <path-to-test-file>    # one test file
mise run test:e2e             # Playwright (apps/dapp/e2e/); needs browsers installed
```

## Definition of done

Run these before declaring any task complete. CI runs exactly the same gates.

- [ ] `mise run typecheck` — zero errors
- [ ] `mise run check:ci` — zero errors
- [ ] `mise run lint` — zero errors
- [ ] `mise run test` — all pass; new logic has tests
- [ ] `mise run test:coverage` — frontend feature/entity logic meets thresholds
- [ ] `mise run build` — if you touched build-relevant code or config
- [ ] `mise run test:e2e:production` — production-server browser behavior
- [ ] `mise run test:protocol` — generated contracts and compatibility
- [ ] `mise run security:audit` — no known high-severity dependency issue
- [ ] `mise run test:docker` — release images and PostgreSQL recovery path

Deploys are CI-gated only (`.github/workflows/deploy.yml`; `develop` → staging,
`main` → production). NEVER deploy from a local machine.

## Architecture rules

### Dapp architecture — FSD-inspired layered frontend

Next.js framework entrypoints stay outside the FSD root. They are thin adapters
that delegate to the appropriate Bootstrap segment or Screen public API:

```text
apps/dapp/
  app/                         Next pages/layout/Route Handlers only
  proxy.ts                     Next proxy entrypoint only
  instrumentation*.ts          Next instrumentation entrypoints only
  src/
    bootstrap/                 app composition: routes, providers, metadata,
                               errors, proxy, instrumentation, styles
    screens/{home,sign-in,account,not-found}/
                               complete route screens; api/model/ui + public API
    features/sign-in/          reusable sign-in interaction; api/model/ui
    entities/session/          session domain API/model + client/server APIs
    shared/                    api, config, focused lib/*, routes, ui
    styled-system/             generated Panda code; never hand-edit
```

Conceptual dependency direction is one-way:

```text
Next framework entrypoints → bootstrap → screens → widgets → features → entities → shared
```

Layers are optional. `widgets` is intentionally absent until a reusable,
self-contained UI block exists. `bootstrap` and `shared` contain segments rather
than slices. The explicit names keep framework-owned `app/` distinct from
application composition and avoid the overloaded FSD `app`/`pages` terminology.

1. Imports point downward only. Same-layer slices are isolated and MUST NOT
   import each other.
2. Every slice and every `bootstrap`/`shared` segment exposes a Public API. External
   consumers never deep-import internals. All frontend-local module specifiers,
   including imports inside one slice, use absolute aliases (`@/` for `src/` and
   dapp-only `@root/` when a source module must reach the workspace root).
3. Server-only exports use `index.server.ts`; client-only exports use
   `index.client.ts`. Never mix a `server-only` module into a client API.
4. Segments are purpose-named (`api`, `model`, `ui`, `config`), never
   essence-named (`components`, `hooks`, `types`, `services`, `utils`). Focused
   Shared libraries live under `shared/lib/[purpose]/index.ts`.
5. `app/`, root proxy, and root instrumentation files contain only framework
   contracts, static Next exports, and public-API delegation—zero business logic.
6. Steiger enforces the standard lower FSD layers/public APIs; ESLint covers the
   project-specific `bootstrap`/`screens` layers and framework entrypoints. Run
   `pnpm --filter @apps/dapp lint:architecture` after structural changes.
7. `src/styled-system/**` is generated Panda code and the only top-level FSD
   exception. Never hand-edit it.
8. Monorepo boundaries remain: `packages/` → `packages/` only; `services/` →
   `packages/` only; nothing imports from `apps/`.

### Admin architecture — FSD-inspired layered frontend

`apps/admin` uses explicit application layers and purpose-named segments:

```text
src/
  bootstrap/              entrypoint, providers, router, global styles
  screens/[name]/         complete route screens; api/model/ui + index.ts
  widgets/app-shell/      reusable protected-route layout
  features/[action]/      reusable product interactions (currently absent)
  entities/{session,user}/ domain models, data access, queries + index.ts
  shared/                 api, config, focused lib/*, model, routes, ui
```

Dependency direction is strictly downward: `bootstrap → screens → widgets →
features → entities → shared`. Layers are optional: admin currently has no `features/`
because sign-in, create-user, and service-health are each used by only one page
and therefore belong to those Screen slices. Do not create a layer or slice merely
to make the folder tree look complete.

1. Slices on the same layer are isolated and MUST NOT import each other.
2. Every slice and every `bootstrap`/`shared` segment exposes a Public API (`index.ts`);
   external consumers never deep-import internals. Same-slice imports also use
   the absolute `@/` alias; relative frontend imports/exports are rejected.
3. Segment names describe purpose (`ui`, `api`, `model`, `config`), never file
   essence (`components`, `hooks`, `types`, `services`, `utils`). Focused Shared
   libraries use `shared/lib/[purpose]/index.ts`.
4. `bootstrap/router` only composes Screen and Widget Public APIs. Route screens
   and screen-specific data/UI live in `screens/[name]`, not in `bootstrap`.
5. Add an Entity for a business noun reused by higher layers. Add a Feature only
   for a meaningful interaction reused across pages or independently consumed.
6. Steiger checks the standard lower FSD layers; ESLint checks direction,
   isolation, and Public APIs for `bootstrap`/`screens`. Run
   `pnpm --filter @apps/admin lint:architecture` after structural changes.
7. `src/styled-system/**` is generated Panda code and the only top-level FSD
   exception. Never hand-edit it.

### Landing architecture — FSD-inspired layered frontend

`apps/landing` uses Astro route entrypoints in `astro/pages/` and layered
application code in `src/`. Its current direction is `Astro entrypoints →
screens → widgets → shared`; `features` and `entities` are intentionally absent
until the product has reusable user interactions or domain entities. SEO and
global styles are Shared segments because this static app needs no Bootstrap
layer.

1. Imports point downward only. Slices on the same layer never import each other.
2. Every slice and every `shared` segment exposes an `index.ts` Public API;
   external consumers never deep-import internals. All local Astro/TypeScript
   module specifiers use the absolute `@/` alias, including same-slice imports.
3. Segment names describe purpose (`ui`, `model`, `config`, `seo`, `styles`),
   never file essence (`components`, `hooks`, `types`, `data`).
4. `astro/pages/` contains thin framework entrypoints only. Screen composition
   lives in `src/screens/[name]`; independent page blocks live in `src/widgets`.
5. A static section describing product features is a widget, not an FSD feature.
   Add an FSD feature only for a reusable user interaction that provides value.
6. Run `pnpm --filter @apps/landing lint:architecture` after structural changes.

### Backend architecture — Feature-first pragmatic Hexagonal

The backend is a **coarse-grained modular system** organized by business
capability. The default unit of change is a vertical slice under `features/`.
Inside a slice, use Hexagonal architecture (Ports & Adapters) only where a real
domain invariant or external boundary justifies it. Simple RPCs stay simple;
complex capabilities may grow `domain/`, `application/`, `adapters/`, and
`infra/` inside their own slice. This is NOT the frontend's FSD pattern.

| Boundary | This repo |
|----------|-----------|
| **Published contract** | `packages/protocol` — Protobuf service/method definitions |
| **Shared multi-runtime RPCs** | `packages/api-core` — capability slices shared by Node and Workers |
| **Service capability** | `services/*/src/features/[capability]` — one isolated vertical slice |
| **Driving adapters** | service-root `adapters/` — Hono, Fastify, Cloudflare bindings |
| **Driven adapters** | feature-local `infra/` — providers, storage, VPC/DO adapters behind ports |

**The Dependency Rule** — across workspaces: `services/* → api-core → protocol`.
Inside a service, composition/config/root adapters consume feature Public APIs;
inside a feature, dependencies point inward: `adapters/infra → application →
domain`. Features NEVER import one another. Shared policy/logging primitives may
be imported by application code but contain no feature business logic. Domain
and application code import no Hono, Connect, Cloudflare, Fastify, Request, or
Response runtime types.

**Shared application core (`packages/api-core`):**

```
packages/api-core/src/
  adapters/connect/           Connect route/fetch adapters + Connect error mapping
  features/[capability]/      schema + pure service + thin Connect handler + index.ts
  shared/                     transport-neutral config/CORS helpers; zero business logic
  index.ts                    PUBLIC package barrel — the ONLY service import surface
```

`api-core` is not a dumping ground. Add a capability there only when the same
behavior genuinely runs in more than one runtime. Service-owned business
capabilities stay in their owning service.

**Node service (`services/trading-rpc`):**

```
src/
  index.ts                    composition root; the only env reader
  adapters/http.adapter.ts    Nest/Fastify host + Connect plugin + gRPC listener
  adapters/http/              Nest HTTP controllers
  adapters/grpc/              shared native Nest gRPC controllers
  platform/nest/              root module, interceptors, lifecycle providers
  features/market-data/       reference capability; see features/README.md
    domain/                   value objects, aggregate data, domain errors + ports
    application/              input port + use case
    adapters/connect/         Connect response/error mapping
    adapters/grpc/            Nest controller + Zod pipe + safe RPC filter
    infra/coingecko/          provider-specific outbound adapter
    infra/postgres/           Drizzle schema/repository + generated migrations
    market-data.module.ts     feature-local Nest DI wiring
    index.ts                  PUBLIC feature API
  config/                     validated runtime config
  infra/                      transport selection + Protobuf asset resolution
```

`trading-rpc` is a Nest hybrid application with two intentional listeners.
Cloudflare `api-gateway` calls the Connect endpoint through the private VPC
`Fetcher` binding. Node microservices call the separate native Nest gRPC port.
Both inbound adapters resolve the same feature input port from Nest DI; domain
and application code remain framework-free. Raw Connect plugin requests use
Fastify/Connect cross-cutting hooks; Nest guards, pipes, filters, and
interceptors apply to the native gRPC and Nest HTTP controllers, not implicitly
to Connect routes.

**Admin service (`services/admin-rpc`):**

```
src/
  index.ts                    composition root; the only env reader
  adapters/http.adapter.ts    Nest/Fastify host + Connect plugin + gRPC listener
  features/authentication/
    domain/                   credential-verifier and token-issuer ports
    application/              Login use case
    adapters/{connect,grpc}/  AuthService validation and safe error mapping
    infra/{configured,jwt}/   constant-time credentials + signed JWT adapter
    authentication.module.ts
    index.ts                  PUBLIC feature API
  features/coin-information/
    domain/                   coin primitives, typed error, trading-rpc port
    application/              admin GetMarkets input port + orchestration
    adapters/{connect,grpc}/  AdminService transport validation/error mapping
    infra/grpc/               native gRPC TradingService client adapter
    coin-information.module.ts
    index.ts                  PUBLIC feature API
  platform/nest/              root module, interceptors, lifecycle providers
  config/                     validated runtime config and downstream timeout
  infra/                      transport selection + Protobuf asset resolution
```

`admin-rpc` exposes `auth.v1.AuthService/Login` and
`admin.v1.AdminService/GetMarkets` over Connect and native gRPC. Authentication
validates server-side configured credentials and issues a short-lived HS256 JWT
using the same environment secret enforced by api-gateway. The market-data
application use case calls a transport-neutral driven port; the
feature-local gRPC adapter calls `trading.v1.TradingService/GetMarkets` on
`TRADING_RPC_GRPC_URL`. It validates the downstream response with Zod, applies
`TRADING_RPC_TIMEOUT_MS`, and maps transport/response failures to a typed safe
domain error. CoinGecko and market persistence remain owned by `trading-rpc`.

**Edge gateway (`services/api-gateway`):**

```
src/
  index.ts                    Cloudflare composition root
  adapters/                   generic Worker/Hono composition only
    cloudflare/               runtime binding types
    http/                     app, error, request-scope, runtime middleware
  features/
    README.md                 capability clone guide + naming contract
    access-control/
      application/            authorization input/output ports + use case
      adapters/http/          capability-owned Hono middleware
      infra/hono/             JWT verifier implementation
      index.ts                PUBLIC feature API
    rate-limiting/
      domain/                 policy, identifier, token-bucket aggregate + port
      application/            consume-token + enforce-rate-limit use cases
      adapters/{http,cloudflare}/
                              Hono middleware + Durable Object inbound adapter
      infra/cloudflare/       Durable Object port/repository implementations
      index.ts                PUBLIC feature API
    rpc-routing/
      domain/                 typed routing errors
      application/            endpoint port + routing use case
      adapters/http/          catch-all Hono handler
      infra/{api-core,cloudflare}/
                              local endpoint + private Trading RPC proxy
      index.ts                PUBLIC feature API
  shared/{access-policy,logging}/
                              cross-feature policy and logging ports/adapters
  config/                     validated bindings + operational options
```

Hard rules (enforced by `scripts/check-backend-architecture.ts` through each
workspace's `lint:architecture` command):

1. Every feature exposes `features/[capability]/index.ts`; production consumers
   outside the slice import only that Public API. Tests may import the unit under
   test directly.
2. Same-layer feature slices are isolated and MUST NOT import one another. Move
   a genuinely shared primitive downward into `shared/`; otherwise compose above.
3. **Handlers/adapters are thin** — validate external input, invoke the use case,
   and map domain results/errors to the transport. They contain no business rules.
4. **Application use cases** own orchestration, depend only on domain models,
   ports, and allowed Shared primitives, and are unit-tested (target ≥ 80%).
5. **Domain code** owns invariants and imports only its own domain. It never
   references frameworks, generated contracts, runtime globals, or outer layers.
6. Add ports/repositories only for real external boundaries or persistence that
   must be substituted or isolated. Do not create controller/service/repository
   chains, generic repositories, or interfaces for pure local helpers.
7. Validate ALL external input with **Zod at the handler/adapter boundary**
   (`Z`-prefixed schema; proto gives structural types, Zod gives semantic ones).
8. Services throw typed domain errors. Connect/HTTP/gRPC adapters map them to safe
   transport errors/envelopes and NEVER leak internal messages.
9. Env/secrets are read only in the composition root or validated runtime-config
   boundary. Import `@packages/api-core` only via its root barrel.
10. After structural changes run all four relevant `lint:architecture` commands;
    the shared checker automatically discovers every `features/*` directory.
11. All backend services use TypeScript-only source and service-local
    architecture scripts. All local imports use configured
    aliases (`@/`, `@scripts/`, and the narrow `@repo/architecture-checker`
    tooling alias); relative imports are rejected by their architecture
    checkers.
12. All backend services require a validated `SERVICE_NAME` runtime value.
    Composition roots inject it into health and telemetry adapters; production
    code MUST NOT hardcode, derive, or silently default the logical service
    identity. Worker resource names, package names, and runtime labels are
    separate concerns.

### HTTP layer

- Components MUST NOT call `fetch()`/axios.
- `apps/dapp` data flows UI → model hook → same-slice `api/` → a configured
  transport from `@/shared/api`. ConnectRPC modules use typed shared clients;
  REST/BFF modules use `xhr`. Components call neither transport directly.
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
export { LoginForm } from '@/features/sign-in/ui/login-form'

// features/sign-in/index.server.ts — separate server-only public API
import 'server-only'
export { verifyCredentials } from '@/features/sign-in/model/verify-credentials.server'
```

Import order: React/Next → external packages → `@/shared/*` → `@/entities/*` →
`@/features/*` → `@/widgets/*` → `@/screens/*` → `@/bootstrap/*` → `@root/*` →
styles. Frontend source, tests, and framework entrypoints never use relative
module specifiers; framework-generated files are the only exception. `import type`
last.

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

- Application configuration MUST use the validated env module
  (`apps/dapp/src/shared/config/env.ts`, `apps/admin/src/shared/config/env.ts`).
  Direct reads are allowed only for framework/tool-owned execution flags such as
  `NODE_ENV`, `CI`, `NEXT_RUNTIME`, and build-plugin switches inside framework
  config, instrumentation, test-runner config, or validated config adapters.
  Document every application variable in the workspace `.env.sample`.
- Validate ALL external input with Zod at trust boundaries (server actions,
  route handlers, RPC handlers).
- Server modules use `import 'server-only'`.
- CSP: dapp builds a nonce-based CSP in `src/bootstrap/proxy/proxy.ts`, delegated by
  root `proxy.ts` — the nonce and CSP MUST be set on request headers (not only
  the response). Admin/landing ship static headers via `public/_headers`.
- Backend CORS is allowlist-driven via `CORS_ORIGINS` (handled in
  `packages/api-core` and the Node RPC services).
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
    `(dapp)`, `(admin)`, `(landing)`, `(trading-rpc)`, `(gateway)`, `(protocol)`, `(infra)`
  - `!` after type/scope marks a breaking change
  - Keep the header ≤ 100 chars (soft limit — hook only warns)
  - `Merge/Revert/fixup!/squash!` headers bypass validation
  - Examples: `feat(dapp): add user profile page` ·
    `fix(trading-rpc): handle empty echo payload` ·
    `refactor!: drop the legacy RPC client`
- Branch: `type(scope)/short-kebab-description` — lowercase kebab; scope
  optional. Examples: `feat(dapp)/user-profile`, `chore/upgrade-turborepo`.
  Exempt: `main|develop|staging|release/*|hotfix/*|dependabot/*|renovate/*`.
- PR: title follows the commit convention; body has Summary, Test plan,
  Breaking changes.
- Keep PRs at or below 150 changed files and 20,000 changed lines. A deliberately
  larger atomic migration requires explicit human scope review and the
  `large-change-reviewed` label before CI may proceed.
- Versioning/changelogs are automated (release-please manifest mode) — NEVER
  hand-edit `CHANGELOG.md` or `version` fields.

## Deployment

- `infra/docker` is the single source of truth for all Dockerfiles and Compose
  configuration. Workspaces MUST NOT contain their own Dockerfiles. Keep one
  Dockerfile per deployable image and environment differences in Compose
  overlays; run `make check-docker` after changes.
- All application deploys are CI-driven via `.github/workflows/deploy.yml`, gated on a
  green CI run: push to `develop` → staging; push to `main` → production
  (behind a required manual approval in the GitHub `production` Environment).
  NEVER run `wrangler deploy` / `pnpm deploy:*` from a local machine.
- Cloudflare targets use `wrangler.jsonc` `env.staging` / `env.production`
  blocks with distinct worker names — deploys MUST pass an explicit
  `--env staging|production`.
- Rollback: `wrangler rollback --env production` (Workers keep prior versions).
- `services/{admin-rpc,trading-rpc}` build Docker images from
  `infra/docker/{admin-rpc,trading-rpc}.Dockerfile` (multi-stage, non-root,
  `/healthz` healthcheck); `infra/docker/postgres.Dockerfile` supplies the
  existing PostgreSQL 18 + pgBackRest/R2 recovery runtime. All three images
  deploy to one private EC2 host per environment. Terraform under
  `infra/terraform` owns VPC, fixed EC2, protected encrypted EBS, ECR, IAM,
  Secrets Manager, KMS, observability, Cloudflare Tunnel, and Workers VPC Services. Infrastructure
  plan/apply runs only through `.github/workflows/terraform.yml`; never apply
  Terraform locally. Application CI uses GitHub OIDC, immutable ECR commit-SHA
  tags, ECR vulnerability scanning, and SSM rollout—never SSH. AWS RDS is not
  part of this topology; do not bypass the repository's Docker PostgreSQL
  backup/PITR/restore design.
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
| Relative frontend import/export | the configured `@/` or `@root/` alias |
| Cross-slice imports on the same layer | compose above or extract downward |
| `any` / `as any` | `unknown` + type guard |
| Application env read outside a config boundary | validated env config module |
| Default export on non-page files | named exports |

## MCP tools (when available)

- **code-review-graph** — use before reading raw files:
  `semantic_search_nodes` (find symbols), `get_impact_radius` (blast radius
  before refactoring), `detect_changes` (staged-change risk),
  `query_graph pattern="callers_of"` (find callers).
- **Context7** — current library docs: `resolve_library_id` →
  `get_library_docs` (prefer over stale training data).
