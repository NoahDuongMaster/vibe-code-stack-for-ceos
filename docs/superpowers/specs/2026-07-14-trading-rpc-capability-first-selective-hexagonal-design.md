# Trading RPC Capability-First Selective Hexagonal Design

## Goal

Make `services/trading-rpc` the reference implementation for backend
capabilities: business capability first at the top level, with Hexagonal
layers only where the capability has real domain rules or runtime boundaries.

## Scope

- Rename the operation-shaped `get-crypto-markets` feature to the stable
  business capability `market-data`.
- Preserve all RPC contracts, runtime behavior, validation, error mapping,
  provider behavior, and deployment behavior.
- Keep the existing complete Hexagonal example because market data has both an
  inbound Connect boundary and an outbound CoinGecko boundary.
- Document which directories are required, which are optional, and how a new
  developer clones the example without copying unused abstractions.
- Keep architecture enforcement generic so newly added capabilities are
  discovered without allowlists.

## Target Structure

```text
services/trading-rpc/src/
  index.ts
  adapters/
    http.adapter.ts
  config/
    runtime-config.ts
  infra/
    rpc-transport.ts
  features/
    README.md
    market-data/
      index.ts
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
        quote-currency.ts
        quote-currency.test.ts
      adapters/
        connect/
          get-markets.schema.ts
          trading-service.routes.ts
          trading-service.routes.test.ts
      infra/
        coingecko/
          coingecko-market-data.adapter.ts
          coingecko-market-data.adapter.test.ts
```

## Dependency Rules

```text
composition/config/root adapters -> feature index
feature adapters/infra -> application -> domain
feature infra -> domain ports
```

- `domain/` imports only its own domain.
- `application/` imports only its own application/domain and allowed shared
  primitives.
- `adapters/` and `infra/` may depend inward but never import service-root
  runtime/config modules.
- Production consumers outside a capability import only its `index.ts`.
- Capabilities never import one another.
- All service-local imports use configured aliases; relative imports are
  rejected by architecture lint.

## Naming Rules

- Capability directory: business noun in kebab-case, for example
  `market-data`, `order-management`, `portfolio`, `risk-management`.
- Operation files: verb-noun, for example `get-markets.use-case.ts` and
  `place-order.command.ts`.
- Outbound boundary: `<dependency>.port.ts`.
- Runtime implementation: `<provider>-<dependency>.adapter.ts`.
- Transport registration: `<service>.routes.ts`.
- Zod trust-boundary schema: `<operation>.schema.ts`.
- Public API: `index.ts`.

## Progressive Adoption

A simple capability starts flat and adds directories only when needed. The
`market-data` example deliberately demonstrates the full form because it owns
domain normalization, exposes ConnectRPC, and integrates with CoinGecko.
Developers cloning it must delete layers and files that their capability does
not use.

## Behavior Preservation

The existing Vitest suite and architecture fixtures are the regression lock.
The refactor is complete only when targeted tests, architecture lint,
typecheck, repository checks, full tests, and the production build pass.
