export type RpcTransport = 'http1' | 'http2';

/**
 * The edge-facing Connect listener defaults to HTTP/1.1 because Cloudflare's
 * private VPC binding uses Fetch. Native gRPC has its own Nest listener.
 */
export function resolveRpcTransport(
  rawTransport: string | undefined,
): RpcTransport {
  if (rawTransport === undefined || rawTransport === '') {
    return 'http1';
  }
  if (rawTransport === 'http1' || rawTransport === 'http2') {
    return rawTransport;
  }
  throw new Error(
    `Invalid RPC_TRANSPORT: "${rawTransport}". Expected "http1" or "http2".`,
  );
}
