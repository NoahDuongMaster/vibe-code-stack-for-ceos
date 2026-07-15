# Trading RPC Wire Contract Design

## Goal

Expose one predictable Protobuf contract across ConnectRPC and native gRPC so
clients do not need transport-specific success envelopes, casing rules, or
error parsing.

## Request and response contract

- Protobuf message fields use `lower_snake_case` in `.proto` source.
- Connect ProtoJSON and generated TypeScript use `lowerCamelCase`.
- ProtoJSON parsers may accept original snake_case field names for standards
  compatibility, but documentation and emitted JSON use lowerCamelCase only.
- Native binary gRPC transmits field numbers rather than field names. Nest's
  proto loader uses `keepCase: false`, so TypeScript adapters receive camelCase.
- Successful RPCs return the method response message directly. They never add
  REST-style `{ success, data }` wrappers.

## Error contract

- Every failure uses a canonical gRPC/Connect status code and a short, safe,
  developer-facing English message.
- Validation failures use `INVALID_ARGUMENT` and a stable public message;
  validator-library output never crosses the wire.
- Transient provider failures use `UNAVAILABLE` and a retry-neutral message;
  retry policy remains a client/service-config concern.
- Unexpected failures use `INTERNAL` and never expose exception messages,
  stack traces, provider payloads, or configuration.
- Connect serializes the standard error object. Native gRPC sends the same
  status semantics in trailers. Neither transport introduces an application
  error envelope.
- Clients branch on status codes, never on message text.

## Rich error details

Do not add rich details until a client has a concrete need for structured field
violations, retry guidance, or a stable domain reason. When required, use
typed Protobuf details compatible with `google.rpc.Status`; do not invent
feature-specific JSON shapes. This keeps the baseline model interoperable with
all gRPC libraries while leaving a standards-based extension path.

## Verification

Integration tests prove canonical camelCase output, ProtoJSON snake_case input
compatibility, exact safe validation messages, and equivalent status codes for
Connect and native gRPC.
