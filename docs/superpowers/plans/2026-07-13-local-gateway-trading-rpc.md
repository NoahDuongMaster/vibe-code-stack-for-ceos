# Local Gateway–Trading RPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run `api-gateway → trading-rpc` end to end on one developer machine without a Cloudflare Tunnel, while retaining the VPC Service path for deployed environments.

**Architecture:** `TRADING_RPC` remains the only deployed upstream, and wins whenever it is bound. A `LOCAL_TRADING_RPC_URL` fallback is honored only when `ENVIRONMENT=development`; it uses native Worker `fetch()` to reach the local Node server. Since workerd uses HTTP/1.1 for this local origin, the Node service runs HTTP/1.1 in its `dev` script; production keeps HTTP/2 for native gRPC.

**Tech Stack:** Cloudflare Vite plugin/workerd, Hono 4, Fastify 5, Connect-RPC 2, Vitest 4, Turborepo.

---

## File structure

- `services/api-gateway/src/types.ts`: explicit development-only URL and environment bindings.
- `services/api-gateway/src/infra/proxy.ts`: one proxy primitive shared by VPC and local HTTP targets.
- `services/api-gateway/src/index.ts`: selects VPC first, then the guarded development fallback.
- `services/api-gateway/src/index.test.ts`: proves local routing, environment guard, and VPC precedence.
- `services/api-gateway/.dev.vars.sample`: runnable local binding values.
- `services/api-gateway/vite.config.ts`: stable, loopback-only dev port `8787`.
- `services/trading-rpc/src/adapters/http.adapter.ts`: explicit `http2` option.
- `services/trading-rpc/src/adapters/http.adapter.test.ts`: proves Connect RPC works over HTTP/1.1.
- `services/trading-rpc/src/index.ts`: validates and applies the development transport selection.
- `services/trading-rpc/package.json`: sets `NODE_ENV=development` for the dev process.
- `package.json` and `README.md`: one command and an operator recipe for the local pair.

### Task 1: Make the Node RPC server reachable through HTTP/1.1 in development

**Files:**
- Modify: `services/trading-rpc/src/adapters/http.adapter.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.test.ts`

- [ ] **Step 1: Write the failing HTTP/1.1 Connect test**

```ts
import { createConnectTransport } from '@connectrpc/connect-node';

it('should serve a Connect Echo request over HTTP/1.1 when HTTP/2 is disabled', async () => {
  await start({ http2: false });
  const client = createClient(
    ApiService,
    createConnectTransport({ baseUrl, httpVersion: '1.1' }),
  );

  await expect(client.echo({ message: 'local' })).resolves.toMatchObject({
    upper: 'LOCAL',
    runtime: 'node',
  });
});
```

- [ ] **Step 2: Verify the test is red**

Run: `pnpm --filter @services/trading-rpc exec vitest run src/adapters/http.adapter.test.ts -t "HTTP/1.1"`

Expected: FAIL because `ServerOptions` has no `http2` setting and Fastify is always created with HTTP/2.

- [ ] **Step 3: Add the smallest server option**

```ts
export interface ServerOptions {
  // existing options
  /** Enables native gRPC over HTTP/2. Defaults to true. */
  http2?: boolean;
}

const app = fastify({
  http2: options.http2 ?? true,
  // existing Fastify options
});
```

- [ ] **Step 4: Verify the focused test is green**

Run: `pnpm --filter @services/trading-rpc exec vitest run src/adapters/http.adapter.test.ts -t "HTTP/1.1"`

Expected: PASS.

### Task 2: Default the development process to HTTP/1.1 without changing production

**Files:**
- Modify: `services/trading-rpc/src/index.ts`
- Modify: `services/trading-rpc/package.json`
- Modify: `services/trading-rpc/.env.sample`

- [ ] **Step 1: Write the failing transport-selection test**

Add a small exported transport parser in `src/index.ts` or a dedicated colocated testable helper. It must return `'http1'` when `NODE_ENV=development`, return `'http2'` otherwise, and throw for a non-empty `RPC_TRANSPORT` value other than `http1` or `http2`.

- [ ] **Step 2: Verify the parser test is red**

Run: `pnpm --filter @services/trading-rpc exec vitest run <transport-test-file>`

Expected: FAIL because no validated transport selection exists.

- [ ] **Step 3: Apply the parsed transport in the composition root**

```ts
const rpcTransport = requireRpcTransport();

server = await createServer({
  http2: rpcTransport === 'http2',
  // existing validated options
});
```

Set the `dev` script to prefix `NODE_ENV=development`; leave `start` unchanged. Document `RPC_TRANSPORT=http2` as an optional local override in `.env.sample`.

- [ ] **Step 4: Verify focused and existing native gRPC tests are green**

Run: `pnpm --filter @services/trading-rpc test`

Expected: PASS; default test-server behavior still supports native gRPC while the development entrypoint selects HTTP/1.1.

### Task 3: Add a development-only gateway fallback

**Files:**
- Modify: `services/api-gateway/src/types.ts`
- Modify: `services/api-gateway/src/infra/proxy.ts`
- Modify: `services/api-gateway/src/index.ts`
- Modify: `services/api-gateway/src/index.test.ts`

- [ ] **Step 1: Write failing gateway tests**

```ts
it('should proxy an unhandled route to LOCAL_TRADING_RPC_URL in development', async () => {
  const fetchMock = vi.fn(async (request: Request) =>
    new Response('local trading-rpc', { headers: { 'x-target': request.url } }),
  );
  vi.stubGlobal('fetch', fetchMock);

  const res = await worker.fetch(new Request('http://gateway.test/crypto?currency=usd'), {
    ENVIRONMENT: 'development',
    LOCAL_TRADING_RPC_URL: 'http://127.0.0.1:3001',
  });

  expect(await res.text()).toBe('local trading-rpc');
  expect(res.headers.get('x-target')).toBe('http://127.0.0.1:3001/crypto?currency=usd');
});

it('should not honor LOCAL_TRADING_RPC_URL outside development', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  const res = await worker.fetch(new Request('http://gateway.test/crypto'), {
    ENVIRONMENT: 'production',
    LOCAL_TRADING_RPC_URL: 'http://127.0.0.1:3001',
  });

  expect(res.status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify tests are red**

Run: `pnpm --filter @services/api-gateway exec vitest run src/index.test.ts -t "LOCAL_TRADING_RPC_URL"`

Expected: first test FAILS with `404`; the development fallback does not exist.

- [ ] **Step 3: Implement the guarded target selector**

Declare typed `ENVIRONMENT` and `LOCAL_TRADING_RPC_URL` bindings. Extract the existing response-streaming/error/CORS stripping logic into a private proxy helper that receives an origin and a fetch-capable target. Keep `proxyToTradingRpc()` on the VPC `Fetcher`; add `proxyToLocalTradingRpc()` using global `fetch`. In the fallback route, use this precedence:

```ts
if (res.status !== 404) return res;
if (c.env.TRADING_RPC) return proxyToTradingRpc(c, c.env.TRADING_RPC);
if (c.env.ENVIRONMENT === 'development' && c.env.LOCAL_TRADING_RPC_URL) {
  return proxyToLocalTradingRpc(c, c.env.LOCAL_TRADING_RPC_URL);
}
return res;
```

- [ ] **Step 4: Verify the gateway suite is green**

Run: `pnpm --filter @services/api-gateway test`

Expected: PASS, including existing VPC error/CORS tests.

### Task 4: Make the local route discoverable and reproducible

**Files:**
- Modify: `services/api-gateway/.dev.vars.sample`
- Modify: `services/api-gateway/vite.config.ts`
- Modify: `services/api-gateway/wrangler.jsonc`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add local environment sample values**

```dotenv
ENVIRONMENT=development
LOCAL_TRADING_RPC_URL=http://127.0.0.1:3001
```

State explicitly that this fallback is local-only and not a substitute for a VPC Service binding in staging or production.

- [ ] **Step 2: Pin the gateway dev endpoint**

```ts
export default defineConfig({
  plugins: [cloudflare()],
  server: { host: '127.0.0.1', port: 8787, strictPort: true },
});
```

- [ ] **Step 3: Add the paired Turbo command and README recipe**

```json
"dev:gateway": "turbo run dev --filter=@services/api-gateway",
"dev:backend": "turbo run dev --filter=@services/api-gateway --filter=@services/trading-rpc"
```

Document:

```bash
cp services/api-gateway/.dev.vars.sample services/api-gateway/.dev.vars
pnpm dev:backend
curl -i http://127.0.0.1:8787/crypto?currency=usd
```

Explain that a route returns the Node service response once the crypto RPC is added; today, `/crypto` exercises the hop and returns Fastify’s 404.

- [ ] **Step 4: Run an actual two-process smoke test**

Run `pnpm dev:backend`, wait for `http://127.0.0.1:3001` and `http://127.0.0.1:8787`, then run:

```bash
curl --fail --silent http://127.0.0.1:3001/healthz
curl --fail --silent http://127.0.0.1:8787/healthz
curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8787/crypto
```

Expected: the first two return JSON liveness responses; the last returns `404` from `trading-rpc`, confirming the local proxy hop for an as-yet-unimplemented crypto route.

### Task 5: Verify the repository gates

**Files:**
- Verify only.

- [ ] **Step 1: Format touched files**

Run: `pnpm exec biome format --write services/api-gateway services/trading-rpc package.json README.md docs/superpowers/plans/2026-07-13-local-gateway-trading-rpc.md`

- [ ] **Step 2: Run focused service gates**

Run: `pnpm --filter @services/api-gateway typecheck && pnpm --filter @services/api-gateway lint && pnpm --filter @services/trading-rpc typecheck && pnpm --filter @services/trading-rpc lint`

Expected: PASS.

- [ ] **Step 3: Run root gates and report unrelated failures separately**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:ci`

Expected: all gates related to this change pass. Preserve and report any pre-existing unrelated worktree failures without modifying them.

## Self-review

- **Coverage:** The plan covers offline local testing, production VPC preservation, HTTP/1.1 compatibility, developer ergonomics, automated regression coverage, and an actual two-process smoke test.
- **No placeholders:** All changed files, behavior, commands, and expected results are specified.
- **Type consistency:** `LOCAL_TRADING_RPC_URL`, `ENVIRONMENT`, `TRADING_RPC`, `http2`, and `RPC_TRANSPORT` use the same names in all tasks.
