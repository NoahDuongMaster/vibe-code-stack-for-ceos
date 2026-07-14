# Trading Crypto Microservice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose current crypto market information and prices through `TradingService`, owned wholly by `services/trading-rpc` and reachable from the dapp through `services/api-gateway`.

**Architecture:** `packages/protocol` owns only the wire contract. `services/trading-rpc` owns the validation, use case, domain errors, and a CoinGecko outbound adapter; its composition root injects the adapter into the Fastify/Connect server. The Hono gateway never imports the trading feature: its existing 404 fallback proxies the `TradingService` request unchanged through the VPC binding or the development-only localhost target.

**Tech Stack:** Protobuf-ES v2 + Buf, Connect-RPC v2, Fastify 5, Zod 4, CoinGecko Demo REST API, Hono 4, Vitest 4.

---

### Task 1: Define the service-owned RPC contract

**Files:**
- Create: `packages/protocol/proto/trading/v1/trading.proto`
- Modify: `packages/protocol/src/index.ts`
- Generated: `packages/protocol/src/gen/trading/v1/trading_pb.ts`

- [x] **Step 1: Add the contract before service implementation**

```proto
syntax = "proto3";

package trading.v1;

message GetMarketsRequest {
  repeated string coin_ids = 1;
  string vs_currency = 2;
}

message CryptoMarket {
  string id = 1;
  string symbol = 2;
  string name = 3;
  optional string image_url = 4;
  optional double current_price = 5;
  optional double market_cap = 6;
  optional int32 market_cap_rank = 7;
  optional double price_change_24h = 8;
  optional double price_change_percentage_24h = 9;
  optional double total_volume = 10;
  optional string last_updated = 11;
}

message GetMarketsResponse {
  repeated CryptoMarket markets = 1;
  string vs_currency = 2;
}

service TradingService {
  rpc GetMarkets(GetMarketsRequest) returns (GetMarketsResponse) {}
}
```

- [x] **Step 2: Re-export and generate the source of truth**

```ts
export * from './gen/api/v1/api_pb.js';
export * from './gen/trading/v1/trading_pb.js';
```

Run: `pnpm --filter @packages/protocol generate && pnpm --filter @packages/protocol lint`

Expected: generated descriptor exports `TradingService`; Buf lint passes.

### Task 2: Specify crypto behavior with failing tests

**Files:**
- Create: `services/trading-rpc/src/features/crypto/crypto.service.test.ts`
- Create: `services/trading-rpc/src/infra/coingecko-market.repository.test.ts`
- Modify: `services/trading-rpc/src/adapters/http.adapter.test.ts`
- Modify: `services/api-gateway/src/index.test.ts`
- Modify: `packages/api-client/src/index.test.ts`

- [x] **Step 1: Write the service test against an injected repository port**

```ts
const repository = {
  getMarkets: vi.fn(async () => [bitcoin]),
};

await expect(getMarketsService.getMarkets({
  coinIds: ['bitcoin'],
  vsCurrency: 'usd',
}, repository)).resolves.toEqual([bitcoin]);
```

- [x] **Step 2: Write the CoinGecko adapter tests**

```ts
const repository = createCoinGeckoMarketRepository({
  apiKey: 'demo-key',
  fetch: fetchMock,
});

await expect(repository.getMarkets({
  coinIds: ['bitcoin'],
  vsCurrency: 'usd',
})).resolves.toMatchObject([{ id: 'bitcoin', currentPrice: 70000 }]);

expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining('/coins/markets?'),
  expect.objectContaining({ headers: { 'x-cg-demo-api-key': 'demo-key' } }),
);
```

- [x] **Step 3: Write transport and gateway tests**

```ts
const client = createClient(
  TradingService,
  createConnectTransport({ baseUrl, httpVersion: '1.1' }),
);

await expect(client.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }))
  .resolves.toMatchObject({ markets: [{ id: 'bitcoin' }] });
```

```ts
const res = await worker.fetch(
  rpcRequest('http://gateway.test/trading.v1.TradingService/GetMarkets', {
    coinIds: ['bitcoin'],
    vsCurrency: 'usd',
  }),
  { TRADING_RPC: tradingRpc },
);

expect(fetch).toHaveBeenCalledOnce();
```

- [x] **Step 4: Run the focused tests and observe red**

Run: `pnpm --filter @services/trading-rpc test -- crypto.service.test.ts coingecko-market.repository.test.ts adapters/http.adapter.test.ts && pnpm --filter @packages/api-client test -- index.test.ts && pnpm --filter @services/api-gateway test -- index.test.ts`

Expected: failures identify the missing crypto service, CoinGecko repository, `TradingService` server registration, and typed trading client.

### Task 3: Implement the trading service, not api-core

**Files:**
- Create: `services/trading-rpc/src/features/crypto/crypto.schema.ts`
- Create: `services/trading-rpc/src/features/crypto/crypto.repository.ts`
- Create: `services/trading-rpc/src/features/crypto/crypto.service.ts`
- Create: `services/trading-rpc/src/features/crypto/crypto.handler.ts`
- Create: `services/trading-rpc/src/features/crypto/index.ts`
- Create: `services/trading-rpc/src/infra/coingecko-market.repository.ts`

- [x] **Step 1: Validate the boundary and isolate provider types**

```ts
export const ZGetMarketsInput = z.object({
  coinIds: z.array(z.string().trim().regex(/^[a-z0-9-]+$/)).min(1).max(50),
  vsCurrency: z.string().trim().toLowerCase().regex(/^[a-z]{3,10}$/),
});

export interface CryptoMarketRepository {
  getMarkets(input: TGetMarketsInput): Promise<TCryptoMarket[]>;
}
```

- [x] **Step 2: Implement the use case and provider adapter**

```ts
export const getMarketsService = {
  async getMarkets(input: TGetMarketsInput, repository: CryptoMarketRepository) {
    try {
      return await repository.getMarkets(input);
    } catch (error) {
      throw toTradingDomainError(error);
    }
  },
};
```

```ts
const url = new URL('/api/v3/coins/markets', 'https://api.coingecko.com');
url.searchParams.set('ids', input.coinIds.join(','));
url.searchParams.set('vs_currency', input.vsCurrency);
url.searchParams.set('price_change_percentage', '24h');
```

- [x] **Step 3: Map Connect input and failures in the feature handler**

```ts
router.service(TradingService, {
  getMarkets: getMarketsHandler(repository),
});
```

The handler maps Zod validation errors to `Code.InvalidArgument` and provider failures to `Code.Unavailable`; it maps nullable CoinGecko fields to absent proto optional fields.

- [x] **Step 4: Run the focused tests and observe green**

Run: `pnpm --filter @services/trading-rpc test -- crypto.service.test.ts coingecko-market.repository.test.ts adapters/http.adapter.test.ts`

Expected: all crypto behavior and Fastify/Connect registration tests pass.

### Task 4: Wire dependencies at the Node composition root and publish the typed client

**Files:**
- Modify: `services/trading-rpc/src/adapters/http.adapter.ts`
- Modify: `services/trading-rpc/src/index.ts`
- Modify: `services/trading-rpc/.env.sample`
- Modify: `packages/api-client/src/index.ts`

- [x] **Step 1: Inject the repository through `createServer()`**

```ts
server = await createServer({
  cryptoMarketRepository: createCoinGeckoMarketRepository({
    apiKey: process.env.COINGECKO_API_KEY,
  }),
  // existing transport, CORS, body-limit, and rate-limit options
});
```

`process.env` remains limited to `services/trading-rpc/src/index.ts`; the repository constructor receives plain validated values.

- [x] **Step 2: Publish a separate client for the microservice contract**

```ts
export const createTradingClient = (
  baseUrl: string,
  options?: Omit<Parameters<typeof createConnectTransport>[0], 'baseUrl'>,
): Client<typeof TradingService> =>
  createClient(TradingService, createConnectTransport({ baseUrl, ...options }));
```

- [x] **Step 3: Document the non-secret local configuration**

```dotenv
# Free Demo API key from CoinGecko Developer Dashboard. Required for live data.
COINGECKO_API_KEY=
```

- [x] **Step 4: Run client and service tests**

Run: `pnpm --filter @packages/api-client test && pnpm --filter @services/trading-rpc test`

Expected: the client exposes `getMarkets`; server calls use the injected repository.

### Task 5: Preserve the gateway as a transparent boundary and document local use

**Files:**
- Modify: `services/api-gateway/src/index.ts`
- Modify: `services/api-gateway/src/index.test.ts`
- Modify: `README.md`

- [x] **Step 1: Assert the `TradingService` Connect path proxies instead of being handled locally**

The gateway must continue to call its local `ApiService` handler first; because that handler has no `TradingService` route, `POST /trading.v1.TradingService/GetMarkets` reaches `TRADING_RPC` (or `LOCAL_TRADING_RPC_URL` only in development) unchanged.

- [x] **Step 2: Replace the obsolete `/crypto` curl example**

```bash
curl -sS -X POST http://127.0.0.1:8787/trading.v1.TradingService/GetMarkets \
  -H 'content-type: application/json' \
  -H 'connect-protocol-version: 1' \
  --data '{"coinIds":["bitcoin","ethereum"],"vsCurrency":"usd"}'
```

The documentation explicitly says `COINGECKO_API_KEY` must be set in `services/trading-rpc/.env` for live provider data.

- [x] **Step 3: Run gateway and local integration verification**

Run: `pnpm --filter @services/api-gateway test && pnpm dev:backend`

Expected: the focused gateway proxy test passes; with a configured demo key the curl command returns a Connect JSON response from `trading-rpc`.

### Task 6: Verify repository gates

**Files:**
- No production files beyond Tasks 1–5.

- [x] **Step 1: Check generated contract drift**

Run: `pnpm --filter @packages/protocol generate:check`

Expected: no diff after generation.

- [x] **Step 2: Run quality gates**

Run: `pnpm typecheck && pnpm check:ci && pnpm lint && pnpm test && pnpm build`

Expected: all gates pass, or report pre-existing failures with the exact files and no unrelated edits.
