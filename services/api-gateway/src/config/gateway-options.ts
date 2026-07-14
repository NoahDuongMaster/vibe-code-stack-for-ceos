/** Operational paths that bypass both authentication and rate limiting. */
export const PUBLIC_PATHS = ['/healthz', '/api.v1.ApiService/Health'] as const;

export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Connect-Protocol-Version',
  'Connect-Timeout-Ms',
  'X-Grpc-Web',
  'X-User-Agent',
] as const;
export const CORS_ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS'] as const;

export const RATE_LIMIT_POLICY = {
  limit: 300,
  periodMs: 60_000,
} as const;

/** Stable Host header supplied to the private VPC Service binding. */
export const TRADING_RPC_ORIGIN = 'http://trading-rpc.internal';

export const UPSTREAM_TIMEOUT_MS = 10_000;
