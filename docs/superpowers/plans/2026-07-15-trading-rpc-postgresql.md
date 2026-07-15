# Trading RPC Drizzle ORM migration plan

**Goal:** Replace the raw `pg` repository SQL with Drizzle ORM and Drizzle Kit
without changing the market-data application/domain contracts.

**Architecture:** Keep `pg.Pool` as the connection driver, wrap it with
`drizzle-orm/node-postgres`, declare the table in a feature-local schema file,
and execute generated migrations through Drizzle's runtime migrator during Nest
bootstrap.

**Tech stack:** Drizzle ORM 0.45, Drizzle Kit 0.31, node-postgres 8,
PostgreSQL 18, NestJS 11, Vitest 4.

1. Change the repository tests to require a typed Drizzle schema, Drizzle
   multi-row conflict update, Drizzle migration invocation, empty-write skip,
   and pool shutdown; run them and verify they fail before implementation.
2. Add `drizzle-orm` and `drizzle-kit`, feature-local schema definitions,
   `drizzle.config.ts`, and database scripts.
3. Generate the initial Drizzle migration and replace the raw SQL adapter with
   `DrizzleMarketSnapshotRepository` while preserving the public repository port.
4. Update runtime asset copying, Docker runtime dependencies, public exports,
   architecture documentation, and developer commands.
5. Run focused tests and build, recreate Docker services, verify Drizzle's
   migration journal plus market upserts through Gateway/VPC, then run all CI
   gates.
