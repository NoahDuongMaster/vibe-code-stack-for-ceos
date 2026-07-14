# Trading RPC Senior Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `trading-rpc` production-ready through validated runtime configuration and dependency-inverted application boundaries.

**Architecture:** The crypto bounded context remains unchanged: domain → application → adapters/infra. `RuntimeConfig` is a cross-cutting parser that receives an environment record but never reads `process.env`; only `src/index.ts` reads and supplies it. HTTP and Connect adapters depend on the application input port, not `GetCryptoMarketsUseCase` itself. The existing explicit Fastify HTTP/1.1 and HTTP/2 branches stay separate because they preserve Fastify's literal overload types.

**Tech Stack:** TypeScript 6 strict, Zod 4, Fastify 5, Connect-RPC 2, Vitest 4, tsup.

---

### Task 1: Validate runtime configuration before bootstrapping

**Files:**
- Create: `services/trading-rpc/src/config/runtime-config.test.ts`
- Create: `services/trading-rpc/src/config/runtime-config.ts`
- Modify: `services/trading-rpc/src/index.ts`

- [x] **Step 1: Write failing tests for defaults, normalization, and invalid numeric values**

```ts
expect(parseRuntimeConfig({ NODE_ENV: 'development' })).toMatchObject({
  port: 3001,
  rpcTransport: 'http1',
  corsOrigins: [],
});

expect(() => parseRuntimeConfig({ PORT: '-1' })).toThrow('PORT');
```

- [x] **Step 2: Run the focused test and observe module-not-found**

Run: `pnpm --filter @services/trading-rpc exec vitest run src/config/runtime-config.test.ts`

Expected: failure because `runtime-config.ts` does not yet exist.

- [x] **Step 3: Add a pure parser that returns the typed composition configuration**

```ts
export interface TRuntimeConfig {
  port: number;
  rpcTransport: RpcTransport;
  corsOrigins: string[];
  coingeckoApiKey?: string;
  sentryDsn?: string;
  maxBodyBytes: number;
  requestTimeoutMs: number;
  rateLimit: number;
  rateLimitWindowMs: number;
}

export function parseRuntimeConfig(
  environment: Record<string, string | undefined>,
): TRuntimeConfig {
  const parsed = ZRuntimeEnvironment.safeParse(environment);
  if (!parsed.success) {
    throw new Error(`Invalid runtime configuration: ${z.prettifyError(parsed.error)}`);
  }
  return {
    port: parsed.data.PORT ?? 3001,
    rpcTransport: resolveRpcTransport(parsed.data.RPC_TRANSPORT, parsed.data.NODE_ENV),
    corsOrigins: (parsed.data.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    coingeckoApiKey: parsed.data.COINGECKO_API_KEY,
    sentryDsn: parsed.data.SENTRY_DSN,
    maxBodyBytes: parsed.data.MAX_BODY_BYTES ?? 5 * 1024 * 1024,
    requestTimeoutMs: parsed.data.REQUEST_TIMEOUT_MS ?? 30_000,
    rateLimit: parsed.data.RATE_LIMIT ?? 300,
    rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_MS ?? 60_000,
  };
}
```

- [x] **Step 4: Make `index.ts` the only `process.env` reader and use its parsed config**

```ts
const config = parseRuntimeConfig(process.env);
server = await createServer({
  getCryptoMarkets: new GetCryptoMarketsUseCase(provider),
  corsOrigins: config.corsOrigins,
  http2: config.rpcTransport === 'http2',
});
```

- [x] **Step 5: Run focused configuration tests**

Run: `pnpm --filter @services/trading-rpc exec vitest run src/config/runtime-config.test.ts`

Expected: all configuration tests pass.

### Task 2: Invert the application dependency at the adapter boundary

**Files:**
- Create: `services/trading-rpc/src/application/get-crypto-markets/get-crypto-markets.port.ts`
- Modify: `services/trading-rpc/src/application/get-crypto-markets/get-crypto-markets.use-case.ts`
- Modify: `services/trading-rpc/src/adapters/connect/trading-service.routes.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.ts`
- Modify: `services/trading-rpc/src/adapters/{connect/trading-service.routes,http.adapter}.test.ts`

- [x] **Step 1: Add a failing import-based test that invokes the Connect handler through a minimal application input port**

```ts
import type { GetCryptoMarkets } from '@/application/get-crypto-markets/get-crypto-markets.port';

const getCryptoMarkets: GetCryptoMarkets = {
  execute: vi.fn(async () => [bitcoinSnapshot]),
};
const handler = createGetCryptoMarketsHandler(getCryptoMarkets);
```

Run: `pnpm --filter @services/trading-rpc exec vitest run src/adapters/connect/trading-service.routes.test.ts`

Expected: failure because the `GetCryptoMarkets` port module is absent.

- [x] **Step 2: Define the application input port and implement it in the use case**

```ts
export interface GetCryptoMarkets {
  execute(query: MarketDataQuery): Promise<readonly MarketSnapshot[]>;
}

export class GetCryptoMarketsUseCase implements GetCryptoMarkets { /* existing delegation */ }
```

- [x] **Step 3: Replace concrete use-case parameters in Connect and HTTP adapters**

```ts
export const createGetCryptoMarketsHandler = (
  getCryptoMarkets: GetCryptoMarkets,
) => /* validate → execute → map */;
```

- [x] **Step 4: Run the focused adapter tests**

Run: `pnpm --filter @services/trading-rpc exec vitest run src/adapters/connect/trading-service.routes.test.ts src/adapters/http.adapter.test.ts`

Expected: Connect error mapping and both HTTP transports remain green.

### Task 3: Verify the service and repository gates

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-trading-rpc-senior-refactor.md`

- [x] **Step 1: Run service quality gates**

Run: `pnpm --filter @services/trading-rpc typecheck && pnpm --filter @services/trading-rpc lint && pnpm --filter @services/trading-rpc test && pnpm --filter @services/trading-rpc build`

Expected: all pass.

- [x] **Step 2: Run monorepo gates and diff validation**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && git diff --check`

Result: all pass. `pnpm check:ci` separately reports its pre-existing unrelated
findings in `.github/assets/readme-cover.svg`, `apps/dapp/src/app/page.tsx`,
and `apps/landing/src/shared/data/site.ts`.
