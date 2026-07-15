# API Gateway VPC-Only Routing Design

## Goal

Make the Cloudflare `TRADING_RPC` VPC Service binding the only transport from
`api-gateway` to `trading-rpc` in every runtime, including local development.

## Architecture

- `TRADING_RPC` is a required Cloudflare `Fetcher` binding.
- The composition root fails closed with a safe `500` response when the binding
  is absent; local health routes do not bypass this invariant.
- `RouteRpcRequestUseCase` always owns two endpoints: the local api-core endpoint
  and the VPC-backed trading endpoint. A local miss is always delegated to VPC.
- The legacy direct-URL variable, global `fetch` transport, and local-fallback
  script are removed.
- Docker development selects `env.development` through
  `CLOUDFLARE_ENV=development`; Wrangler authenticates through a Docker secret.

## Configuration and Security

- The development VPC Service ID remains in `wrangler.jsonc` with
  `remote: true`.
- The Cloudflare API token is stored only in
  `infra/docker/secrets/cloudflare-api-token`, which is Git-ignored and mounted
  as a Docker secret.
- Staging and production must provision separate VPC Service IDs before deploy;
  production code has no URL fallback.

## Verification

- Unit test the missing-binding failure and mandatory trading endpoint.
- Run gateway tests, architecture lint, Compose validation, and Docker smoke.
- Run repository typecheck, formatting, lint, tests, and build.
