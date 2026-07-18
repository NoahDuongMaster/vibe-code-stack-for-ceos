import { type Client, createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import {
  AdminService,
  HealthService,
  TradingService,
} from '@packages/protocol';

/**
 * End-to-end type-safe client for the shared health contract (Connect RPC).
 *
 * Point it at any runtime serving HealthService (trading-rpc, api-gateway, …).
 * Every call is typed from the proto contract — no drift, gRPC-compatible:
 *
 *   const client = createApiClient('http://localhost:3001')
 *   const res = await client.health({})
 *   res.status // 'ok' — fully typed
 */
export const createApiClient = (
  baseUrl: string,
  options?: Omit<Parameters<typeof createConnectTransport>[0], 'baseUrl'>,
): Client<typeof HealthService> =>
  createClient(HealthService, createConnectTransport({ baseUrl, ...options }));

export type ApiClient = Client<typeof HealthService>;

/** Typed client for the service-owned TradingService, normally via the gateway. */
export const createTradingClient = (
  baseUrl: string,
  options?: Omit<Parameters<typeof createConnectTransport>[0], 'baseUrl'>,
): Client<typeof TradingService> =>
  createClient(TradingService, createConnectTransport({ baseUrl, ...options }));

export type TradingClient = Client<typeof TradingService>;

/** Typed client for the admin facade, which delegates coin data to trading-rpc. */
export const createAdminClient = (
  baseUrl: string,
  options?: Omit<Parameters<typeof createConnectTransport>[0], 'baseUrl'>,
): Client<typeof AdminService> =>
  createClient(AdminService, createConnectTransport({ baseUrl, ...options }));

export type AdminClient = Client<typeof AdminService>;

// Re-export the generated message types for consumers/UI.
export type {
  AdminServiceGetMarketsRequest,
  AdminServiceGetMarketsResponse,
  CryptoMarket,
  GetMarketsRequest,
  GetMarketsResponse,
  HealthResponse,
} from '@packages/protocol';
