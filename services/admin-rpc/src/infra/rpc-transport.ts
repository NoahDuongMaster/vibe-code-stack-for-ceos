export type RpcTransport = 'http1' | 'http2';

/** The Connect listener is separate from the native gRPC listener. */
export function resolveRpcTransport(
  rawTransport: string | undefined,
): RpcTransport {
  if (rawTransport === undefined || rawTransport === '') return 'http1';
  if (rawTransport === 'http1' || rawTransport === 'http2') {
    return rawTransport;
  }
  throw new Error(
    `Invalid RPC_TRANSPORT: "${rawTransport}". Expected "http1" or "http2".`,
  );
}
