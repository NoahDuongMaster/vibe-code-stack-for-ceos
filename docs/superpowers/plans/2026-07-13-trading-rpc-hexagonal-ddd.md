# Trading RPC — Hexagonal Architecture + Tactical DDD Refactor Plan

> **For agentic workers:** Execute this plan task by task, keeping all crypto
> business logic inside `services/trading-rpc`.

**Goal:** Refactor the crypto market query into explicit Hexagonal Architecture
layers with tactical DDD concepts, without changing the Connect-RPC contract or
moving the domain to `packages/api-core`.

**Architecture:** `trading-rpc` is the crypto bounded context. The domain owns
the ubiquitous-language value objects (`CoinId`, `QuoteCurrency`), immutable
market model (`MarketSnapshot`), market-data provider port, and safe domain
error. The application layer exposes `GetCryptoMarketsUseCase`. The Connect
handler is the inbound adapter and validates external input with Zod. CoinGecko
is an outbound infrastructure adapter that maps provider JSON into domain
models. `src/index.ts` remains the only composition root that selects and
injects the adapter.

**Deliberate tactical-DDD boundary:** this is a read-only external-market query,
with no local lifecycle or consistency boundary. `MarketSnapshot` is therefore
an immutable domain model/value object, rather than inventing a meaningless
Aggregate and repository.

## Target layout

```text
services/trading-rpc/src/
  domain/crypto-market/
    coin-id.ts
    quote-currency.ts
    market-snapshot.ts
    market-data-provider.port.ts
    errors.ts
  application/get-crypto-markets/
    get-crypto-markets.use-case.ts
  adapters/connect/
    get-crypto-markets.schema.ts
    trading-service.routes.ts
  infra/coingecko/
    coingecko-market-data.adapter.ts
  adapters/http.adapter.ts
  index.ts
```

### Task 1: Characterize the domain and use case with failing tests

**Files:**
- Create: `src/domain/crypto-market/coin-id.test.ts`
- Create: `src/domain/crypto-market/quote-currency.test.ts`
- Create: `src/application/get-crypto-markets/get-crypto-markets.use-case.test.ts`

- [x] Add tests showing that the value objects normalize valid input and reject
  invalid values, and that the use case calls only the injected `MarketDataProvider` port.
- [x] Run the three tests and observe the expected module-not-found failures.

### Task 2: Implement the domain and application rings

**Files:**
- Create: `src/domain/crypto-market/{coin-id,quote-currency,market-snapshot,market-data-provider.port,errors}.ts`
- Create: `src/application/get-crypto-markets/get-crypto-markets.use-case.ts`

- [x] Implement invariant-enforcing value objects and an immutable provider-neutral
  market model.
- [x] Define the port in the domain and inject it into the application use case.
- [x] Run the focused domain/application tests.

### Task 3: Move inbound and outbound adapters to the edges

**Files:**
- Create: `src/adapters/connect/{get-crypto-markets.schema,trading-service.routes}.ts`
- Create: `src/infra/coingecko/coingecko-market-data.adapter.ts`
- Modify: `src/adapters/http.adapter.ts`
- Modify: `src/index.ts`

- [x] Keep Zod and Connect/protobuf imports exclusively in the inbound adapter.
- [x] Make the CoinGecko adapter implement the domain port, validate provider JSON,
  and translate all transport/provider failures to the domain error.
- [x] Compose `GetCryptoMarketsUseCase` and its CoinGecko adapter only in
  `src/index.ts`; inject a use case into the HTTP adapter.
- [x] Update endpoint and CoinGecko-adapter tests to assert the new contracts.

### Task 4: Remove the former pseudo-feature and verify the service

**Files:**
- Delete: `src/features/crypto/**`
- Delete: `src/infra/coingecko-market.repository.{ts,test.ts}`
- Modify: affected imports and tests

- [x] Delete the old feature folder only after the replacement tests are green.
- [x] Run `pnpm --filter @services/trading-rpc test`, typecheck, lint and build.

### Task 5: Verify all repository quality gates

- [x] Run `pnpm typecheck`, `pnpm check:ci`, `pnpm lint`, `pnpm test`, and
  `pnpm build`.
- [x] Report known pre-existing check failures separately from this refactor.
