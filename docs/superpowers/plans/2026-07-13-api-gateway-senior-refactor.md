# API Gateway Senior Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Cloudflare `api-gateway` into a thin, testable Hono edge adapter with validated runtime configuration, clear composition and infrastructure boundaries, and absolute internal imports.

**Architecture:** `src/index.ts` will become the Worker composition entry only, delegating Hono assembly to `src/app.ts`. A config middleware will validate and normalize Worker bindings once per request, expose a typed runtime configuration to CORS/auth/proxy middleware, and prevent unsafe development proxy targets. Existing proxy, auth, rate-limit, and Durable Object behavior remain infrastructure concerns; crypto data logic stays exclusively in `trading-rpc`.

**Tech Stack:** Cloudflare Workers, Hono 4, Durable Objects, Zod 4, Vitest, TypeScript strict, Vite.

---

### Task 1: Establish absolute import and runtime-config boundaries

**Files:**
- Modify: `services/api-gateway/tsconfig.json`
- Modify: `services/api-gateway/vite.config.ts`
- Modify: `services/api-gateway/vitest.config.ts`
- Modify: `services/api-gateway/package.json`
- Modify: `services/api-gateway/src/types.ts`
- Create: `services/api-gateway/src/config/runtime-config.test.ts`
- Create: `services/api-gateway/src/config/runtime-config.ts`

- [x] **Step 1: Add the `@/*` alias to TypeScript, Vite, and Vitest.**

```ts
// tsconfig.json
"paths": { "@/*": ["./src/*"] }

// vite.config.ts and vitest.config.ts
{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }
```

- [x] **Step 2: Add the direct Zod 4 dependency required to validate Worker bindings.**

```json
"dependencies": {
  "@packages/api-core": "workspace:*",
  "hono": "4.12.28",
  "zod": "4.4.3"
}
```

- [x] **Step 3: Write a failing runtime-config test.**

```ts
it('should normalize development configuration and expose a safe local upstream origin', () => {
  expect(parseGatewayRuntimeConfig({
    ENVIRONMENT: 'development',
    CORS_ORIGINS: 'https://admin.example.com, https://dapp.example.com, https://admin.example.com',
    LOCAL_TRADING_RPC_URL: 'http://127.0.0.1:3001',
  })).toMatchObject({
    environment: 'development',
    corsOrigins: ['https://admin.example.com', 'https://dapp.example.com'],
    localTradingRpcOrigin: 'http://127.0.0.1:3001',
  });
});
```

- [x] **Step 4: Run the focused test and confirm it fails because the module does not exist.**

Run: `pnpm --filter @services/api-gateway exec vitest run src/config/runtime-config.test.ts`

Expected: FAIL with a module-resolution error for `@/config/runtime-config`.

- [x] **Step 5: Implement a Zod-backed, transport-neutral runtime-config parser.**

```ts
export const parseGatewayRuntimeConfig = (
  bindings: TGatewayBindings,
): TGatewayRuntimeConfig => {
  const input = ZGatewayRuntimeBindings.parse(bindings);
  const environment = input.ENVIRONMENT ?? 'production';

  return {
    environment,
    corsOrigins: normalizeOrigins(input.CORS_ORIGINS),
    jwtSecret: input.JWT_SECRET,
    localTradingRpcOrigin:
      environment === 'development'
        ? parseLocalTradingRpcOrigin(input.LOCAL_TRADING_RPC_URL)
        : undefined,
  };
};
```

`parseLocalTradingRpcOrigin()` must accept only credential-free `http:` or `https:` origin URLs with no path/query/fragment, so the edge proxy cannot silently reinterpret an invalid local target. Rename exported environment types to `T*` names and add `runtimeConfig` to the Hono context variables.

- [x] **Step 6: Run the focused test and confirm it passes.**

Run: `pnpm --filter @services/api-gateway exec vitest run src/config/runtime-config.test.ts`

Expected: PASS.

### Task 2: Make Worker/Hono composition thin and typed

**Files:**
- Create: `services/api-gateway/src/app.ts`
- Modify: `services/api-gateway/src/index.ts`
- Modify: `services/api-gateway/src/index.test.ts`
- Modify: `services/api-gateway/src/infra/auth.ts`
- Modify: `services/api-gateway/src/infra/proxy.ts`
- Create: `services/api-gateway/src/infra/runtime-config.ts`

- [x] **Step 1: Write a failing application-composition test for invalid development proxy configuration.**

```ts
it('should return a generic 500 instead of proxying an unsafe local upstream URL', async () => {
  const response = await createGatewayApp().fetch(
    new Request('http://gateway.test/crypto'),
    {
      ENVIRONMENT: 'development',
      LOCAL_TRADING_RPC_URL: 'ftp://127.0.0.1:3001',
    },
  );

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: { code: 'internal', message: 'Internal Server Error' },
  });
});
```

- [x] **Step 2: Run the focused test and confirm it fails because `createGatewayApp` is not exported.**

Run: `pnpm --filter @services/api-gateway exec vitest run src/index.test.ts`

Expected: FAIL with an export/module error for `@/app` or `createGatewayApp`.

- [x] **Step 3: Build `createGatewayApp()` in `src/app.ts`.**

```ts
export const createGatewayApp = (): Hono<TGatewayAppEnv> => {
  const app = new Hono<TGatewayAppEnv>();
  app.onError(onError);
  app.use('*', requestId());
  app.use('*', secureHeaders(SECURE_HEADERS_OPTIONS));
  app.use('*', runtimeConfig);
  app.use('*', cors(CORS_OPTIONS));
  app.use('*', rateLimit);
  app.use('*', auth);
  app.get('/healthz', healthHandler);
  app.all('*', rpcOrTradingProxyHandler);
  return app;
};
```

`runtimeConfig` must set the parser result on the request context before CORS/auth/proxy reads it. The wildcard handler must retain the existing routing order: local ApiService first, VPC `TRADING_RPC` second, development-only local HTTP fallback last. It must never contain crypto business logic.

- [x] **Step 4: Reduce `src/index.ts` to the stateless Worker entry point.**

```ts
import { createGatewayApp } from '@/app';

export { RateLimiterDO } from '@/infra/rate-limiter.do';
export default createGatewayApp();
```

- [x] **Step 5: Update auth and proxy to consume typed runtime config, then change every internal import in `src/` and tests to `@/…`.**

```ts
const { jwtSecret } = c.get('runtimeConfig');
const { localTradingRpcOrigin } = c.get('runtimeConfig');
```

No code may use `c.env as …`, parse CORS values ad hoc, or import an internal source file with `./` or `../`.

- [x] **Step 6: Run the gateway test suite and confirm composition behavior is preserved.**

Run: `pnpm --filter @services/api-gateway test`

Expected: PASS for local RPC, CORS, VPC/local proxy, auth, rate limiting, and token bucket tests.

### Task 3: Harden infrastructure contracts and observability

**Files:**
- Modify: `services/api-gateway/src/infra/errors.ts`
- Modify: `services/api-gateway/src/infra/rate-limit.ts`
- Modify: `services/api-gateway/src/infra/rate-limiter.do.ts`
- Create: `services/api-gateway/src/infra/logger.ts`
- Modify: `services/api-gateway/src/index.test.ts`

- [x] **Step 1: Write a failing test that confirms invalid runtime configuration is logged without leaking its parser error.**

```ts
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

expect(await response.json()).toEqual({
  error: { code: 'internal', message: 'Internal Server Error' },
});
expect(errorSpy).toHaveBeenCalledWith(
  expect.stringContaining('"service":"api-gateway"'),
);
```

- [x] **Step 2: Run the focused test and confirm the current error path lacks the structured log.**

Run: `pnpm --filter @services/api-gateway exec vitest run src/index.test.ts`

Expected: FAIL before the error boundary is hardened.

- [x] **Step 3: Implement a single gateway logger and use it from the error boundary and rate-limit fail-open branch.**

```ts
export const logGatewayError = (event: TGatewayLogEvent): void => {
  console.error(JSON.stringify({ service: 'api-gateway', ...event }));
};
```

The error response body must remain the existing stable, generic envelope; logs may include the request id, method, pathname, and an error name but never secrets, JWTs, or raw request bodies. Rename exported data-only types to `T*` and convert pure helpers to named `const` exports.

- [x] **Step 4: Run the complete gateway quality suite.**

Run: `pnpm --filter @services/api-gateway typecheck && pnpm --filter @services/api-gateway lint && pnpm --filter @services/api-gateway test && pnpm --filter @services/api-gateway build`

Expected: all commands exit 0.

### Task 4: Verify monorepo integration and document any unrelated worktree failures

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-api-gateway-senior-refactor.md` (check off completed steps)

- [x] **Step 1: Check for remaining relative internal imports and direct environment reads.**

Run: `rg -n "from ['\\\"]\\.{1,2}/|c\\.env as|process\\.env|import\\.meta\\.env" services/api-gateway/src services/api-gateway/test`

Expected: no matches.

- [x] **Step 2: Run repo-level typecheck, formatter check, lint, test, and build.**

Run: `pnpm typecheck && pnpm check:ci && pnpm lint && pnpm test && pnpm build`

Expected: either all pass, or failures are reported precisely as pre-existing/unrelated with their workspace and error.

- [x] **Step 3: Record verification results in the final handoff without committing or deploying.**

The refactor must not run `wrangler deploy`, alter `trading-rpc` crypto logic, or add a placeholder VPC service id.

## Execution results

- Gateway-local verification passed: TypeScript, Biome, 29 Vitest tests,
  Vite production build, and a `GET /healthz` smoke test through local Vite.
- Repository-wide gates were run. They are blocked by unrelated in-progress app
  moves: missing `apps/admin` feature/shared modules, landing Steiger errors,
  and the missing dapp `src/shared/config/env.configuration.ts` build input.
