# Trading RPC PostgreSQL reference design

## Outcome

Add a production-shaped PostgreSQL example to the existing `market-data`
capability without turning the service into a generic repository framework.
Every successful market lookup records the latest provider-neutral snapshots so
developers have a concrete, cloneable database boundary.

## Architecture

- `domain/market-snapshot.repository.port.ts` defines the persistence boundary.
- `application/get-markets.use-case.ts` fetches snapshots, then saves the latest
  state through that port.
- `infra/postgres/schema/` owns feature-local Drizzle schema definitions.
- `infra/postgres/` owns the Drizzle repository, `pg` pool, generated Drizzle
  migrations, and Nest lifecycle.
- The composition root creates the PostgreSQL adapter from validated env and
  passes it to the feature module through its public API.
- Transport adapters remain unchanged and never know PostgreSQL exists.

## Storage contract

PostgreSQL schema `market_data` contains `market_snapshots`, keyed by
`(coin_id, quote_currency)`. Repeated fetches use one typed Drizzle multi-row
upsert, so the table holds the latest known state rather than an unbounded
history.

Database identifiers use `lower_snake_case`; TypeScript and RPC fields remain
`lowerCamelCase`. Provider timestamps use `timestamptz`. Market measurements use
`double precision`, matching the existing finite JavaScript-number domain model.

## Runtime behavior

- `DATABASE_URL` is required; there is no in-memory production fallback.
- One bounded `pg.Pool` is created per process and passed to
  `drizzle-orm/node-postgres`.
- Nest bootstrap runs Drizzle's migrator and fails startup if PostgreSQL is
  unreachable or incompatible. Drizzle records applied migrations in its
  migration journal.
- Nest shutdown drains the pool.
- Empty result sets do not issue a write.
- Persistence failures propagate as the existing safe INTERNAL RPC response;
  database details never cross the transport boundary.

## Docker topology

The base Compose model gains `postgres:18-alpine`, a named persistent volume,
and a dedicated `trading-rpc-data` network shared only with `trading-rpc`. The
development overlay publishes PostgreSQL on loopback for
local diagnostics. `trading-rpc` waits for the PostgreSQL healthcheck before
starting; Cloudflare Tunnel is never attached to the database network.

## Verification

- Unit-test use-case persistence orchestration.
- Unit-test the Drizzle schema, typed upsert mapping, migrations, empty writes,
  and shutdown.
- Validate runtime config and required `DATABASE_URL`.
- Run trading-rpc tests/typecheck/architecture lint/build.
- Validate Compose and smoke-test the real Docker database and RPC persistence.
- Run repository-wide CI gates.
