# Trading RPC capability template

`market-data/` is the reference implementation for backend capabilities in
this service. The repository root `AGENTS.md` remains the authoritative source
for architecture rules; this guide shows how those rules map to concrete files.

## Choose a stable capability name

Name the top-level directory after a business capability, not a transport, SDK,
database table, or single endpoint.

```text
Good: market-data, order-management, portfolio, risk-management
Bad:  get-markets, connect-handlers, coingecko, postgres-repositories
```

One capability may expose several operations. For example, `market-data` can
later own `get-markets`, `get-price-history`, and `stream-prices` without
creating sibling features that share the same model and providers.

## Full reference shape

Use the complete shape only when the capability has domain behavior plus real
inbound and outbound boundaries. `market-data/` demonstrates every supported
role:

```text
features/<capability>/
  index.ts                                public API
  <capability>.module.ts                  feature-local Nest DI wiring
  <capability>.tokens.ts                  explicit Nest injection tokens
  application/
    <operation>.port.ts                   transport-neutral input port
    <operation>.use-case.ts               orchestration
    <operation>.use-case.test.ts
  domain/
    <entity-or-value-object>.ts           business state and invariants
    <entity-or-value-object>.test.ts
    <dependency>.port.ts                  outbound dependency contract
    errors.ts                             typed domain errors
  adapters/
    <operation>.schema.ts                 shared Zod RPC validation
    connect/
      <service>.routes.ts                 Connect request/response mapping
      <service>.routes.test.ts
    grpc/
      <operation>.grpc.pipe.ts            Nest Zod boundary pipe
      <service>.grpc.controller.ts        native Nest gRPC adapter
      <service>.grpc-exception.filter.ts  safe domain-to-gRPC mapping
  infra/
    <provider>/
      <provider>-<dependency>.adapter.ts  SDK/network/storage implementation
      <provider>-<dependency>.adapter.test.ts
```

Concrete example:

```text
market-data/
  index.ts
  market-data.module.ts
  market-data.tokens.ts
  application/
    get-markets.port.ts
    get-markets.use-case.ts
    get-markets.use-case.test.ts
  domain/
    coin-id.ts
    coin-id.test.ts
    errors.ts
    market-data-provider.port.ts
    market-snapshot.ts
    market-snapshot.repository.port.ts
    quote-currency.ts
    quote-currency.test.ts
  adapters/
    get-markets.schema.ts
    connect/
      trading-service.routes.ts
      trading-service.routes.test.ts
    grpc/
      get-markets.grpc.pipe.ts
      trading.grpc.controller.ts
      trading.grpc-exception.filter.ts
  infra/coingecko/
    coingecko-market-data.adapter.ts
    coingecko-market-data.adapter.test.ts
  infra/postgres/
    drizzle-market-snapshot.repository.ts
    drizzle-market-snapshot.repository.test.ts
    drizzle-migrations.test.ts
    schema/
      market-snapshot.schema.ts
      market-snapshot.schema.test.ts
    migrations/
      0000_create_market_snapshots.sql
      meta/                    # Drizzle Kit snapshot + migration journal
```

## Start smaller when the capability is simple

Do not copy empty layers. A simple RPC can begin as:

```text
features/<capability>/
  index.ts
  <operation>.schema.ts
  <operation>.service.ts
  <operation>.handler.ts
  <operation>.service.test.ts
```

Promote files into `domain/`, `application/`, `adapters/`, and `infra/` when a
real boundary appears:

- Add `domain/` for business invariants, lifecycle, policies, or state
  transitions—not for passive DTOs alone.
- Add `application/` when an operation coordinates domain behavior or multiple
  ports—not for a wrapper that only renames one function call.
- Add a port for a database, broker, third-party API, clock, or other dependency
  that the inner code must substitute or isolate.
- Add `adapters/` for inbound transport translation such as ConnectRPC or
  native Nest gRPC. Multiple transports invoke the same application input port.
- Add `infra/` for outbound implementations such as CoinGecko, PostgreSQL, or a
  message broker.

`market-data` demonstrates two independent outbound ports: CoinGecko supplies
current state, while a feature-local Drizzle adapter stores the latest
provider-neutral snapshot in PostgreSQL. The application coordinates both;
neither adapter imports the other. The database schema uses
`lower_snake_case`, while Drizzle's TypeScript model and RPC types stay
`lowerCamelCase`.

Change `schema/*.schema.ts`, then generate rather than hand-writing the next
migration:

```bash
pnpm --filter @services/trading-rpc db:generate
pnpm --filter @services/trading-rpc db:check
```

Normal Nest bootstrap applies pending migrations. For an explicit operator
run against `DATABASE_URL`, use `pnpm --filter @services/trading-rpc db:migrate`.

## Dependency direction

```text
service composition/root adapters
                 |
                 v
        feature index.ts
                 |
       +---------+---------+
       v                   v
inbound adapters      outbound infra
       |                   |
       +---------> application
                          |
                          v
                        domain
```

- `domain/` imports only its own domain files.
- `application/` imports only its own application/domain and allowed Shared
  primitives.
- `adapters/` and `infra/` depend inward and never import root runtime/config.
- Capabilities never import one another; compose them above the feature layer.
- Production consumers outside the capability import only `index.ts`.
- Tests may import the unit under test directly.
- Use `@/` for every import within `src/`; relative imports are forbidden.
- Architecture tooling is TypeScript and uses `@scripts/` plus the narrow
  `@repo/architecture-checker` tooling alias.

These rules are enforced by `pnpm lint:architecture`; the checker discovers
every directory under `features/` automatically.

## Dual-transport boundary

- Connect runs through the official Fastify plugin for Cloudflare VPC
  `Fetcher` traffic. Its cross-cutting controls are Fastify plugins and Connect
  interceptors.
- Native gRPC runs through Nest microservices. Nest pipes, filters,
  interceptors, DI, and lifecycle hooks apply to this listener.
- Do not assume Nest guards or pipes execute for raw Connect plugin routes.
  Put shared business rules in the application/domain layers, below both
  adapters.

## RPC wire contract and casing

Protobuf is the only request/response contract. Do not wrap successful RPC
messages in REST-style `{ success, data }` envelopes: the method response
message is the success payload and the RPC status channel carries failures.

```proto
message GetMarketsRequest {
  repeated string coin_ids = 1;
  string vs_currency = 2;
}
```

Use the casing defined by each boundary:

| Boundary | Canonical field casing | Example |
|---|---|---|
| `.proto` source | `lower_snake_case` | `coin_ids`, `vs_currency` |
| Connect ProtoJSON input/output | `lowerCamelCase` | `coinIds`, `vsCurrency` |
| Generated TypeScript and Nest objects | `lowerCamelCase` | `currentPrice` |
| Binary gRPC wire | field numbers; names are not transmitted | field `5` |

ProtoJSON parsers also accept the original snake_case Protobuf field names for
interoperability, but documentation, examples, TypeScript clients, and emitted
JSON MUST use lowerCamelCase. Native Nest gRPC keeps `keepCase: false`, so its
adapter receives idiomatic camelCase objects before Zod validation.

RPC errors use the transport's standard status model rather than a success
response variant:

```json
{
  "code": "invalid_argument",
  "message": "Safe public message"
}
```

- Connect JSON emits the standard `code` and `message` fields. Native gRPC
  transmits the equivalent gRPC status code and safe message in trailers; it
  does not emit a JSON envelope.
- Domain and application errors never cross the wire directly. Each inbound
  adapter maps them to the same public status semantics.
- Validator-library messages never cross the wire. They are implementation
  details that may change during dependency upgrades.
- Use typed Protobuf error details when clients need a stable machine-readable
  reason, field violations, or retry metadata. Never parse `message` in client
  logic and never add ad-hoc error object shapes per feature.

`market-data` currently exposes these portable public failures:

| Condition | Status | Safe message |
|---|---|---|
| Invalid request | `INVALID_ARGUMENT` | `Invalid market request` |
| Provider unavailable | `UNAVAILABLE` | `Crypto market data is unavailable` |
| Unexpected failure | `INTERNAL` | `Unable to retrieve crypto market data` |

## Naming contract

| Role | File pattern | Example |
|---|---|---|
| Capability | business noun | `market-data/` |
| Use case | `<verb>-<noun>.use-case.ts` | `get-markets.use-case.ts` |
| Input port | `<verb>-<noun>.port.ts` | `get-markets.port.ts` |
| Outbound port | `<dependency>.port.ts` | `market-data-provider.port.ts` |
| Provider adapter | `<provider>-<dependency>.adapter.ts` | `coingecko-market-data.adapter.ts` |
| RPC schema | `<operation>.schema.ts` | `get-markets.schema.ts` |
| RPC registration | `<service>.routes.ts` | `trading-service.routes.ts` |
| Nest gRPC controller | `<service>.grpc.controller.ts` | `trading.grpc.controller.ts` |
| Nest feature module | `<capability>.module.ts` | `market-data.module.ts` |
| Public API | `index.ts` | `market-data/index.ts` |

## Clone checklist

1. Copy `market-data/` to the new kebab-case capability directory.
2. Rename operations, symbols, schemas, errors, ports, providers, tests, and
   descriptions to the new ubiquitous language.
3. Delete every copied file or layer that the new capability does not need.
4. Export the smallest required surface from the capability `index.ts`.
5. Wire the capability only from the service composition root or root adapter.
6. Replace every copied local import with an absolute `@/` alias.
7. Add behavior tests before implementing new logic.
8. Run:

```bash
pnpm --filter @services/trading-rpc test
pnpm --filter @services/trading-rpc typecheck
pnpm --filter @services/trading-rpc lint:architecture
```
