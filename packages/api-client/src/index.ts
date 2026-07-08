import { type Client, createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { ApiService } from '@repo/protocol';

/**
 * End-to-end type-safe client for the backend API (Connect RPC).
 *
 * Point it at any service that serves ApiService (api-node, api-gateway, …).
 * Every call is typed from the proto contract — no drift, gRPC-compatible:
 *
 *   const client = createApiClient('http://localhost:3001')
 *   const res = await client.echo({ message: 'hi' })
 *   res.upper // 'HI' — fully typed
 */
export const createApiClient = (
  baseUrl: string,
  options?: Omit<Parameters<typeof createConnectTransport>[0], 'baseUrl'>,
): Client<typeof ApiService> =>
  createClient(ApiService, createConnectTransport({ baseUrl, ...options }));

export type ApiClient = Client<typeof ApiService>;

// Re-export the generated message types for consumers/UI.
export type { EchoRequest, EchoResponse, HealthResponse } from '@repo/protocol';
