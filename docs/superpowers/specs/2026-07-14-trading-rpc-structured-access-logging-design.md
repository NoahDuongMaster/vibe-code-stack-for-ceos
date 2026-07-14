# Trading RPC Structured Access Logging Design

## Goal

Enrich every Fastify HTTP access log emitted by `services/trading-rpc` with
stable service and operation context while preserving Fastify's built-in
request lifecycle logging and avoiding request or response body logging.

## Approved log contract

Every HTTP/Connect request log includes:

- `serviceName`: validated runtime identity, for example `trading-rpc`.
- `runtime`: the stable value `node`.
- `protocol`: `connect` for Connect RPC paths, otherwise `http`.
- Connect requests: `rpcService` and `rpcMethod` parsed from the canonical
  `/{fully-qualified-service}/{method}` path.
- Non-RPC HTTP requests: `httpMethod` and `httpPath`.
- Fastify's existing `reqId`, response status, timing, level, and message.

Neither request nor response bodies are logged. This avoids secret/PII leakage,
large log events, and coupling observability to evolving wire payloads.

## Considered approaches

1. **Request child-logger bindings (selected).** Configure Fastify's
   `childLoggerFactory` so its existing `incoming request` and
   `request completed` events inherit the context. This preserves built-in
   error/status/timing behavior and avoids duplicate access logs.
2. **Custom `onRequest`/`onResponse` hooks.** Provides complete formatting
   control, but duplicates Fastify lifecycle behavior and requires custom
   timing/error handling.
3. **Response-body logging.** Rejected because it is unsafe, expensive, and not
   necessary to identify the service or RPC operation.

## Components

- A focused Fastify platform helper derives immutable child-log bindings from
  `serviceName`, HTTP method, and raw URL.
- `http.adapter.ts` installs the helper through `childLoggerFactory`.
- `TServerOptions.logger` accepts normal Fastify logger configuration so the
  behavior can be verified through a real in-memory log stream.

## Testing

Integration tests create the real Nest/Fastify server with an in-memory log
stream and assert that completed Connect and plain HTTP requests contain the
approved fields while no body field is present. Existing architecture, unit,
type, lint, and build gates remain unchanged.
