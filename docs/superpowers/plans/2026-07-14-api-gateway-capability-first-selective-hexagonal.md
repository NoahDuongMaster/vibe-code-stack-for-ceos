# API Gateway Capability-First Selective Hexagonal Refactor Plan

## Goal

Make `services/api-gateway` follow the same capability-first, selective
Hexagonal rules as `services/trading-rpc` without changing Worker, Durable
Object, Connect proxy, authorization, rate-limit, CORS, or error behavior.

## Behavior lock

- Preserve the existing 40 Vitest tests covering local Connect RPC, VPC/local
  proxy routing, JWT authorization, rate limiting, fail-open availability,
  CORS, request IDs, safe errors, and the health endpoint.
- Add architecture regression tests before structural edits.
- Keep the existing public `RateLimiterDO` Worker export.

## Target structure

```text
src/
  index.ts
  adapters/
    cloudflare/gateway-bindings.ts
    http/
      gateway-app.ts
      gateway-app-env.ts
      gateway-error-handler.ts
      gateway-request-scope.ts
      gateway-request-scope.factory.ts
      middleware/
        request-scope.middleware.ts
        runtime-config.middleware.ts
  config/
  features/
    README.md
    access-control/
      application/
      adapters/http/auth.middleware.ts
      infra/hono/hono-jwt-token-verifier.adapter.ts
      index.ts
    rate-limiting/
      domain/
      application/
      adapters/
        http/rate-limit.middleware.ts
        cloudflare/rate-limiter.do.ts
      infra/cloudflare/
        durable-object-rate-limiter.adapter.ts
        durable-object-token-bucket.repository.ts
      index.ts
    rpc-routing/
      domain/
      application/
      adapters/http/gateway-rpc.handler.ts
      infra/
        api-core/local-api-core.adapter.ts
        cloudflare/cloudflare-trading-rpc.adapter.ts
      index.ts
  shared/
    access-policy/
    logging/
```

## Cleanup passes

1. Move feature-specific inbound Hono/Cloudflare adapters from the root adapter
   folder into the owning capability.
2. Group outbound adapters by concrete provider/runtime.
3. Make root HTTP composition consume feature Public APIs only.
4. Enforce absolute `@/` imports throughout gateway source and Public APIs.
5. Remove the production `refillAndConsume` compatibility helper; tests use the
   aggregate directly.
6. Add a capability cloning guide and architecture regression suite.
7. Convert service-local architecture tooling to TypeScript and the same
   absolute tooling aliases used by `trading-rpc`.

## Fallback inventory

- Rate limiter exception fail-open: grounded availability policy, logged and
  covered by unit/integration tests; preserve.
- Missing `RATE_LIMITER` disables limiting in local/unconfigured environments:
  grounded runtime configuration behavior, covered by tests; preserve.
- Required `TRADING_RPC` VPC binding: grounded runtime adapter selection,
  validated and covered by tests; preserve.
- Local RPC miss then trading RPC delegation: core routing policy, not a masking
  fallback; preserve.
- JWT verification catch-to-deny: security fail-closed behavior; preserve.
- `refillAndConsume`: test-only compatibility wrapper living in production;
  delete and test `TokenBucket` directly.

## Verification

Run gateway regression tests after each move, then architecture tests, Biome,
typecheck, root lint/test gates, and the production build. Add no dependencies.
