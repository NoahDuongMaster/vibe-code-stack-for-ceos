# Trading RPC Pretty Development Logs Design

## Goal

Make `@services/trading-rpc` logs readable in local terminals without weakening
the structured JSON contract used by staging and production log collectors.

## Approved approach

Use Fastify's Pino logger configuration to select an environment-specific
transport:

- `development`: `pino-pretty`, with colors, local millisecond timestamps, and
  noisy `pid`/`hostname` fields hidden.
- every other environment: native newline-delimited Pino JSON.

This is preferred over custom string formatting because request metadata stays
structured, and over piping the `dev` script because every development launch
path receives the same behavior.

## Architecture

Create a pure platform helper at
`services/trading-rpc/src/platform/fastify/logger-options.ts`. It accepts the
already validated `nodeEnv` value and returns Fastify's logger configuration.
The composition root passes that result into the existing `createServer`
boundary. No module reads `process.env` outside `src/index.ts`.

The existing request child logger remains unchanged. It continues to attach
`serviceName`, `runtime`, `protocol`, RPC method/service, request ID, status,
and response time; `pino-pretty` only changes terminal rendering.

## Docker dependency policy

`pino-pretty` is a development dependency. The trading RPC Dockerfile accepts
an `INCLUDE_PRETTY_LOGGER` build argument. The development Compose overlay sets
it to `true`, while staging and production use the default `false`. Therefore:

- the development image can resolve the pretty transport;
- production images do not ship the development-only formatter;
- the same compiled application can still select JSON from `NODE_ENV`.

## Expected output

Development output should resemble:

```text
[15:42:10.113] INFO: request completed
    serviceName: "trading-rpc"
    reqId: "req-a"
    protocol: "connect"
    rpcService: "api.v1.ApiService"
    rpcMethod: "Health"
    res: { "statusCode": 200 }
    responseTime: 10.11
```

Production output remains machine-readable JSON, one event per line.

## Error and fallback behavior

Only the exact environment name `development` selects `pino-pretty`. Unknown,
test, staging, and production environment names select JSON. This fail-closed
default prevents a misspelled production environment from enabling a terminal
formatter.

## Verification

1. Unit-test development and non-development logger resolution.
2. Run existing trading RPC adapter tests to prove request metadata is intact.
3. Run repository typecheck, formatting, lint, tests, and build gates.
4. Validate all Compose overlays and Dockerfiles.
5. Start the service in development, send a health RPC, and inspect actual
   terminal output for formatted text rather than raw JSON.

