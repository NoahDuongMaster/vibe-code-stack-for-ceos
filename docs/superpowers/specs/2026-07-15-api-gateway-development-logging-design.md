# API Gateway Development Logging Design

## Goal

Make `@services/api-gateway` request logs readable during development while
preserving structured JSON events for staging and production observability.

## Approved approach

Use the existing logging port and console adapter instead of adding Pino to the
Worker bundle. The composition root selects `pretty` only for the validated
`development` environment; every other environment fails closed to `json`.

Add a Hono access-log middleware after request-scope creation. It emits one
`request_completed` event for every response with service, method, pathname,
status, duration, and request ID. Existing typed warning/error events continue
through the same logger.

## Safety and privacy

- Never log request or response bodies.
- Never log query strings, authorization headers, cookies, bindings, or error
  messages.
- Keep request state inside Hono context/request scope.
- Keep invalid-runtime-config fallback logs as safe JSON because no validated
  environment or service identity exists at that failure point.

## Output contract

Development output is a compact terminal line:

```text
[2026-07-15T05:34:56.789Z] INFO  [api-gateway] POST /trading.v1.TradingService/GetMarkets 200 42.31ms requestId=abc-123
```

Non-development output is newline-delimited JSON:

```json
{"timestamp":"2026-07-15T05:34:56.789Z","service":"api-gateway","level":"info","event":"request_completed","method":"POST","pathname":"/trading.v1.TradingService/GetMarkets","statusCode":200,"durationMs":42.31,"requestId":"abc-123"}
```

## Verification

1. Unit-test pretty and JSON serialization.
2. Integration-test that Hono emits one access event without query values.
3. Run gateway tests, typecheck, lint/architecture, and build.
4. Restart the development gateway and inspect a real request log.
