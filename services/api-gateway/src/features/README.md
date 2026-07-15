# API Gateway capability template

The directories under `features/` are the unit of change for gateway business
capabilities. The repository root `AGENTS.md` is authoritative; this guide makes
its Capability-First + Selective Hexagonal rules concrete for this Worker.

## Choose a stable capability name

Name the directory after a business capability, not a framework, transport,
provider, or individual endpoint.

```text
Good: access-control, rate-limiting, rpc-routing, audit-logging
Bad:  hono-middleware, durable-objects, jwt, proxy-handler
```

One capability can own multiple related operations as long as they share the
same policy, model, and external boundaries.

## Full reference shape

Use the complete shape only when the capability has real domain behavior and
both inbound and outbound boundaries:

```text
features/<capability>/
  index.ts                                  public API
  domain/
    <entity-or-value-object>.ts             invariants and state transitions
    <entity-or-value-object>.test.ts
    <dependency>.port.ts                    outbound dependency contract
    errors.ts                               typed domain errors
  application/
    <operation>.port.ts                     transport-neutral input port
    <operation>.use-case.ts                 orchestration
    <operation>.use-case.test.ts
  adapters/
    http/
      <operation>.middleware.ts             Hono request/response mapping
      <operation>.handler.ts
    cloudflare/
      <capability>.do.ts                    Cloudflare inbound adapter
  infra/
    <provider-or-runtime>/
      <provider>-<dependency>.adapter.ts    outbound implementation
      <provider>-<dependency>.adapter.test.ts
```

`rate-limiting/` is the full reference implementation:

```text
rate-limiting/
  index.ts
  domain/
    client-identifier.ts
    rate-limit-policy.ts
    token-bucket.ts
    token-bucket.repository.port.ts
    errors.ts
  application/
    consume-rate-limit-token/
    enforce-rate-limit/
  adapters/
    http/rate-limit.middleware.ts
    cloudflare/rate-limiter.do.ts
  infra/cloudflare/
    durable-object-rate-limiter.adapter.ts
    durable-object-token-bucket.repository.ts
```

## Start smaller

Selective Hexagonal means layers are earned, not copied empty:

- `access-control/` has application ports/use case, one Hono inbound adapter,
  and one Hono JWT outbound adapter. It has no artificial domain entity.
- `rpc-routing/` has typed routing errors, an application use case, one HTTP
  handler, and two endpoint implementations. It has no repository abstraction.
- `rate-limiting/` needs the full shape because token-bucket state, policy
  invariants, Durable Object lifecycle, and persistence are genuine boundaries.

Start a simple capability as:

```text
features/<capability>/
  index.ts
  application/<operation>.port.ts
  application/<operation>.use-case.ts
  application/<operation>.use-case.test.ts
  adapters/http/<operation>.handler.ts
```

Add `domain/` for business invariants or state transitions. Add `infra/` only
for a substitutable database, network, SDK, runtime, clock, or broker boundary.
Do not create generic repositories or controller/service/repository chains.

## Ownership boundary

Root adapters are generic runtime composition only:

```text
adapters/
  cloudflare/gateway-bindings.ts
  http/
    gateway-app.ts
    gateway-error-handler.ts
    gateway-request-scope.ts
    gateway-request-scope.factory.ts
    middleware/
      request-scope.middleware.ts
      runtime-config.middleware.ts
```

A middleware, handler, Durable Object, or provider that exists for one
capability belongs inside that capability. `gateway-app.ts` composes feature
Public APIs; it never deep-imports feature internals.

## Dependency direction

```text
composition root / generic root adapters
                  |
                  v
          feature index.ts
                  |
        +---------+---------+
        v                   v
 inbound adapters       outbound infra
        |                   |
        +---------> application
                           |
                           v
                         domain
```

- `domain/` imports only its own domain.
- `application/` imports only its own application/domain plus allowed Shared
  primitives.
- Feature `adapters/` and `infra/` depend inward and never import root
  `adapters/`, `config/`, or `index.ts`.
- Capabilities never import one another. Compose above them or extract a truly
  cross-feature primitive into `shared/`.
- Production consumers outside a capability import only its `index.ts`.
- Tests may import the unit under test directly.
- Every source import uses the `@/` alias; relative imports are forbidden.
- Architecture scripts are TypeScript and use `@scripts/` plus the narrow
  `@repo/architecture-checker` tooling alias.

These rules are regression-tested and enforced by `pnpm lint:architecture`.

## Edge error contract

HTTP failures use one safe envelope with camelCase JSON property names and
stable snake_case machine codes:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too Many Requests",
    "requestId": "optional-correlation-id"
  }
}
```

Adapters map typed application/domain errors to this boundary. Internal error,
provider, and validator messages never cross the wire. Proxied ConnectRPC
responses keep the standard ConnectRPC success/error contract instead of being
wrapped in this HTTP envelope.

## Operational policies that are intentional

- JWT verification errors deny access (security fail-closed).
- Rate-limiter execution errors are logged and allowed through (availability
  fail-open).
- An absent `RATE_LIMITER` binding disables limiting for local/unconfigured
  runtimes.
- `TRADING_RPC` is a required VPC Service binding in every environment; there
  is no direct-URL transport fallback.
- Edge-owned RPC methods are attempted locally before delegating an unhandled
  method to Trading RPC.

Do not remove or silently change these policies during structural refactors.

## Naming contract

| Role | File pattern | Example |
|---|---|---|
| Capability | business noun | `rate-limiting/` |
| Use case | `<verb>-<noun>.use-case.ts` | `enforce-rate-limit.use-case.ts` |
| Input port | `<verb>-<noun>.port.ts` | `route-rpc-request.port.ts` |
| Outbound port | `<dependency>.port.ts` | `rate-limiter.port.ts` |
| HTTP adapter | `<operation>.middleware.ts` or `.handler.ts` | `auth.middleware.ts` |
| Runtime adapter | `<runtime>-<dependency>.adapter.ts` | `durable-object-rate-limiter.adapter.ts` |
| Durable Object | `<capability>.do.ts` | `rate-limiter.do.ts` |
| Public API | `index.ts` | `rpc-routing/index.ts` |

## Clone checklist

1. Create a kebab-case business capability under `features/`.
2. Begin with only the application operation, its behavior test, the required
   adapter, and `index.ts`.
3. Add domain and infrastructure roles only when real invariants or external
   boundaries appear.
4. Export the smallest surface from `index.ts`.
5. Wire the capability from `src/index.ts` or the generic root HTTP adapter.
6. Use absolute `@/` imports and never import another feature.
7. Keep transport validation and error mapping in the inbound adapter.
8. Run:

```bash
pnpm --filter @services/api-gateway test
pnpm --filter @services/api-gateway typecheck
pnpm --filter @services/api-gateway lint:architecture
```
