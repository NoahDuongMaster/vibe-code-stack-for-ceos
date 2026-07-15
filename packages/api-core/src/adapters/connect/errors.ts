import { Code, ConnectError } from '@connectrpc/connect';

/**
 * Base class for typed errors thrown by the domain layer. Services throw these
 * (staying transport-agnostic — no Connect/HTTP imports); handlers map them to
 * ConnectError. Mirrors the FE rule "services throw typed domain errors;
 * adapters map them" so an internal failure never leaks raw to the client.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: Code = Code.Internal,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Maps any thrown value onto a ConnectError, never leaking internal detail. */
export function toConnectError(error: unknown): ConnectError {
  if (error instanceof ConnectError) return error;
  if (error instanceof DomainError) {
    return new ConnectError(error.message, error.code);
  }
  return new ConnectError('Internal error', Code.Internal);
}
