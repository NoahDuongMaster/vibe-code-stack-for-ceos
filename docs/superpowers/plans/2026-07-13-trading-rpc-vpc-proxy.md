# Trading RPC VPC Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route gateway fallback requests to the private `trading-rpc` service through a Cloudflare Workers VPC Service binding instead of a public upstream URL.

**Architecture:** The Hono gateway keeps CORS, auth, rate limiting, request IDs, response streaming, and error mapping at the edge. When Connect does not own a route locally, the gateway passes a cloned request to the typed `TRADING_RPC` binding; the VPC Service determines the actual private host and port through Cloudflare Tunnel.

**Tech Stack:** Cloudflare Workers VPC Service, Cloudflare Tunnel, Hono 4, Vitest 4, TypeScript 6.

---

## File map

- `services/api-gateway/src/constants.ts`: defines the stable internal request origin used only for the VPC binding request URL.
- `services/api-gateway/src/types.ts`: declares the optional `TRADING_RPC` Worker `Fetcher` binding for local test/development safety.
- `services/api-gateway/src/infra/proxy.ts`: forwards a request through the VPC binding while retaining the current timeout, request-id propagation, error envelope, and response-header mutability.
- `services/api-gateway/src/index.ts`: chooses the local Connect response first and only forwards a 404 through `TRADING_RPC`.
- `services/api-gateway/src/index.test.ts`: proves that the request goes through the binding rather than global `fetch`, preserves path/query/request ID, and handles binding failures.
- `services/api-gateway/wrangler.jsonc`: documents the environment-scoped VPC binding requirement without adding an invalid service ID to a deployable config.
- `services/api-gateway/.dev.vars.sample`: removes the obsolete public-upstream configuration guidance.

### Task 1: Lock the VPC proxy behavior with failing tests

**Files:**
- Modify: `services/api-gateway/src/index.test.ts`

- [ ] **Step 1: Add a binding mock and a failing forwarding test**

```ts
const tradingRpc = {
  fetch: vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    return new Response('trading-rpc body', {
      status: 200,
      headers: { 'x-served-by': request.url },
    });
  }),
} as unknown as Fetcher;

const res = await worker.fetch(
  new Request('http://gateway.test/crypto?currency=usd'),
  { TRADING_RPC: tradingRpc },
);

expect(tradingRpc.fetch).toHaveBeenCalledTimes(1);
expect(res.headers.get('x-served-by')).toBe(
  'http://trading-rpc.internal/crypto?currency=usd',
);
```

- [ ] **Step 2: Run the focused test and verify it fails because `TRADING_RPC` is not used**

Run: `pnpm --filter @services/api-gateway exec vitest run src/index.test.ts -t "VPC"`

Expected: FAIL because the gateway still checks `UPSTREAM_URL` and invokes global `fetch`.

- [ ] **Step 3: Add a failing binding-failure test**

```ts
const tradingRpc = {
  fetch: vi.fn(async () => {
    throw new TypeError('network error');
  }),
} as unknown as Fetcher;

const res = await worker.fetch(
  new Request('http://gateway.test/crypto'),
  { TRADING_RPC: tradingRpc },
);

expect(res.status).toBe(502);
expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
  'bad_gateway',
);
```

- [ ] **Step 4: Run the focused test and verify it fails for the same missing binding path**

Run: `pnpm --filter @services/api-gateway exec vitest run src/index.test.ts -t "VPC"`

Expected: FAIL because a missing VPC binding currently returns the local 404 response.

### Task 2: Implement the typed VPC binding proxy

**Files:**
- Modify: `services/api-gateway/src/constants.ts`
- Modify: `services/api-gateway/src/types.ts`
- Modify: `services/api-gateway/src/infra/proxy.ts`
- Modify: `services/api-gateway/src/index.ts`

- [ ] **Step 1: Add the internal VPC request origin**

```ts
export const TRADING_RPC_ORIGIN = 'http://trading-rpc.internal';
```

- [ ] **Step 2: Replace the public URL binding with the VPC `Fetcher` binding**

```ts
export interface Bindings {
  TRADING_RPC?: Fetcher;
  CORS_ORIGINS?: string;
  JWT_SECRET?: string;
  RATE_LIMITER?: DurableObjectNamespace<RateLimiterDO>;
}
```

- [ ] **Step 3: Forward via the VPC binding and preserve the existing response policy**

```ts
export async function proxyToTradingRpc(
  c: Context<AppEnv>,
  tradingRpc: Fetcher,
): Promise<Response> {
  const target = new URL(c.req.raw.url);
  const upstream = new URL(TRADING_RPC_ORIGIN);
  target.protocol = upstream.protocol;
  target.host = upstream.host;

  const proxied = new Request(target, c.req.raw);
  proxied.headers.set('x-request-id', c.get('requestId'));

  try {
    const res = await tradingRpc.fetch(proxied, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const headers = new Headers(res.headers);
    for (const key of [...headers.keys()]) {
      if (key.startsWith('access-control-')) headers.delete(key);
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    return isTimeout
      ? errorResponse(c, 504, 'upstream_timeout', 'Upstream Timeout')
      : errorResponse(c, 502, 'bad_gateway', 'Bad Gateway');
  }
}
```

- [ ] **Step 4: Select the binding only after the local Connect handler returned 404**

```ts
app.all('*', async (c) => {
  const res = await rpc(c.req.raw);
  if (res.status !== 404 || !c.env.TRADING_RPC) return res;
  return proxyToTradingRpc(c, c.env.TRADING_RPC);
});
```

- [ ] **Step 5: Run the focused gateway test file**

Run: `pnpm --filter @services/api-gateway exec vitest run src/index.test.ts`

Expected: PASS.

### Task 3: Make the deployment configuration unambiguous

**Files:**
- Modify: `services/api-gateway/wrangler.jsonc`
- Modify: `services/api-gateway/.dev.vars.sample`

- [ ] **Step 1: Replace `UPSTREAM_URL` documentation with the VPC Service setup requirement**

Document that `TRADING_RPC` is an environment-scoped `vpc_services` binding, not a plaintext variable or a Worker Service Binding. Document that each environment needs its own Cloudflare Tunnel and VPC Service ID, and that the binding must use `remote: true` for local remote-binding development.

- [ ] **Step 2: Keep `wrangler.jsonc` deployable before account provisioning**

Do not add `vpc_services` with an invented service ID. The config must remain valid until the Cloudflare account owner creates the tunnel and VPC Service.

- [ ] **Step 3: Run static configuration and source validation**

Run: `pnpm --filter @services/api-gateway typecheck && pnpm --filter @services/api-gateway lint`

Expected: both commands exit 0.

### Task 4: Verify the affected workspace

**Files:**
- Verify only

- [ ] **Step 1: Run all gateway tests**

Run: `pnpm --filter @services/api-gateway test`

Expected: PASS.

- [ ] **Step 2: Run repository gates relevant to the shared Worker contract**

Run: `pnpm typecheck && pnpm check:ci && pnpm lint && pnpm test`

Expected: all commands exit 0. Report pre-existing failures separately if the dirty workspace prevents a clean baseline.

- [ ] **Step 3: Do not create a commit**

The user authorized direct edits on `main`, and the worktree already contains unrelated user-owned changes. Leave all changes uncommitted for the user to review.
