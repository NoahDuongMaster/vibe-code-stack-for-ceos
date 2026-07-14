# Remove Echo RPC Design

## Goal

Remove the diagnostic `Echo` RPC from the published backend contract and every
runtime/client surface. `ApiService.Health` and `TradingService.GetMarkets`
remain supported.

## Scope

- Delete `EchoRequest`, `EchoResponse`, and `ApiService.Echo` from the Protobuf
  source, then regenerate Protobuf-ES output.
- Delete the `api-core` Echo feature and remove its route/public exports.
- Delete the native Nest gRPC Echo controller method.
- Replace Echo-based transport, CORS, rate-limit, authentication, and smoke
  tests with Health or GetMarkets according to the behavior under test.
- Remove Echo message exports and examples from `api-client`.
- Update active source comments that claim Echo is supported.

## Contract decision

This is an intentional breaking contract removal. There is no deprecated alias
or handler returning `UNIMPLEMENTED`: clients regenerate from the same Proto
source and no longer see an Echo method at all.

## Validation

Contract tests assert that `ApiService` and its generated client expose Health
but not Echo. Existing Health/GetMarkets behavior and all transport/security
tests must remain green. Finish with protocol generation plus the complete
monorepo typecheck, format, lint, test, and build gates.
