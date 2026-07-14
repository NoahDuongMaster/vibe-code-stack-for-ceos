import { type Client, createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { ApiService, TradingService } from '@packages/protocol';

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

/** Typed client for the service-owned TradingService, normally via the gateway. */
export const createTradingClient = (
  baseUrl: string,
  options?: Omit<Parameters<typeof createConnectTransport>[0], 'baseUrl'>,
): Client<typeof TradingService> =>
  createClient(TradingService, createConnectTransport({ baseUrl, ...options }));

export type TradingClient = Client<typeof TradingService>;

// Re-export the generated message types for consumers/UI.
export type {
  CryptoMarket,
  EchoRequest,
  EchoResponse,
  GetMarketsRequest,
  GetMarketsResponse,
  HealthResponse,
} from '@packages/protocol';
