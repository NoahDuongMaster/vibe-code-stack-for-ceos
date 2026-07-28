const HEALTH_PATHS = ['/healthz', '/health.v1.HealthService/Health'] as const;

export const AUTH_PUBLIC_PATHS = [
  ...HEALTH_PATHS,
  '/auth.v1.AuthService/Login',
  '/trading.v1.TradingService/GetMarkets',
] as const;

export const RATE_LIMIT_EXEMPT_PATHS = HEALTH_PATHS;

export const CORS_ALLOWED_HEADERS = [
  'Authorization',
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

export const AUTH_LOGIN_RATE_LIMIT_POLICY = {
  limit: 10,
  periodMs: 60_000,
} as const;

/** Stable Host header supplied to the private VPC Service binding. */
export const ADMIN_RPC_ORIGIN = 'http://admin-rpc.internal';

/** Stable Host header supplied to the private VPC Service binding. */
export const TRADING_RPC_ORIGIN = 'http://trading-rpc.internal';

export const UPSTREAM_TIMEOUT_MS = 10_000;
