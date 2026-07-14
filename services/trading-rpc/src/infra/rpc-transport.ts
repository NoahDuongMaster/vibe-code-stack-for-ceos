export type RpcTransport = 'http1' | 'http2';

/**
 * Chooses the server protocol from composition-root environment values. Local
 * HTTP/1.1 lets the workerd gateway fetch the Node server directly; every
 * other mode defaults to HTTP/2 so native gRPC remains available.
 */
export function resolveRpcTransport(
  rawTransport: string | undefined,
  nodeEnv: string | undefined,
): RpcTransport {
  if (rawTransport === undefined || rawTransport === '') {
    return nodeEnv === 'development' ? 'http1' : 'http2';
  }
  if (rawTransport === 'http1' || rawTransport === 'http2') {
    return rawTransport;
  }
  throw new Error(
    `Invalid RPC_TRANSPORT: "${rawTransport}". Expected "http1" or "http2".`,
  );
}
