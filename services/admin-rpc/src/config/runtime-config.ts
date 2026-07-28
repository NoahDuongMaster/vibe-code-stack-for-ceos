import { z } from 'zod';
import { type RpcTransport, resolveRpcTransport } from '@/infra/rpc-transport';

export interface TRuntimeConfig {
  serviceName: string;
  nodeEnv: string;
  port: number;
  grpcPort: number;
  tradingRpcGrpcUrl: string;
  tradingRpcTimeoutMs: number;
  adminAuthEmail: string;
  adminAuthPassword: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  rpcTransport: RpcTransport;
  corsOrigins: string[];
  sentryDsn?: string;
  maxBodyBytes: number;
  requestTimeoutMs: number;
  rateLimit: number;
  rateLimitWindowMs: number;
}

const normalizeOptionalString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
};

const ZOptionalString = z.preprocess(
  normalizeOptionalString,
  z.string().optional(),
);

const ZOptionalPositiveInteger = z.preprocess(
  normalizeOptionalString,
  z.coerce.number().int().positive().optional(),
);

const ZTradingRpcGrpcUrl = z.url({ protocol: /^https?$/ }).refine((rawUrl) => {
  const url = new URL(rawUrl);
  return (
    url.username === '' &&
    url.password === '' &&
    (url.pathname === '' || url.pathname === '/') &&
    url.search === '' &&
    url.hash === ''
  );
}, 'TRADING_RPC_GRPC_URL must be an origin without credentials or a path');

const ZRuntimeEnvironment = z.object({
  SERVICE_NAME: z.string().trim().min(1),
  NODE_ENV: ZOptionalString,
  PORT: ZOptionalPositiveInteger,
  GRPC_PORT: ZOptionalPositiveInteger,
  TRADING_RPC_GRPC_URL: ZTradingRpcGrpcUrl,
  TRADING_RPC_TIMEOUT_MS: ZOptionalPositiveInteger,
  ADMIN_AUTH_EMAIL: z.email(),
  ADMIN_AUTH_PASSWORD: z.string().min(12),
  JWT_SECRET: z.string().min(32),
  JWT_TTL_SECONDS: ZOptionalPositiveInteger,
  RPC_TRANSPORT: z.preprocess(
    normalizeOptionalString,
    z.enum(['http1', 'http2']).optional(),
  ),
  CORS_ORIGINS: ZOptionalString,
  SENTRY_DSN: ZOptionalString,
  MAX_BODY_BYTES: ZOptionalPositiveInteger,
  REQUEST_TIMEOUT_MS: ZOptionalPositiveInteger,
  RATE_LIMIT: ZOptionalPositiveInteger,
  RATE_LIMIT_WINDOW_MS: ZOptionalPositiveInteger,
});

const normalizeCorsOrigins = (rawOrigins: string | undefined): string[] =>
  [
    ...new Set((rawOrigins ?? '').split(',').map((origin) => origin.trim())),
  ].filter(Boolean);

export const parseRuntimeConfig = (
  environment: Record<string, string | undefined>,
): TRuntimeConfig => {
  const parsed = ZRuntimeEnvironment.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      `Invalid runtime configuration: ${z.prettifyError(parsed.error)}`,
    );
  }

  return {
    serviceName: parsed.data.SERVICE_NAME,
    nodeEnv: parsed.data.NODE_ENV ?? 'development',
    port: parsed.data.PORT ?? 46_006,
    grpcPort: parsed.data.GRPC_PORT ?? 46_007,
    tradingRpcGrpcUrl: parsed.data.TRADING_RPC_GRPC_URL.replace(/\/+$/, ''),
    tradingRpcTimeoutMs: parsed.data.TRADING_RPC_TIMEOUT_MS ?? 5_000,
    adminAuthEmail: parsed.data.ADMIN_AUTH_EMAIL,
    adminAuthPassword: parsed.data.ADMIN_AUTH_PASSWORD,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtTtlSeconds: parsed.data.JWT_TTL_SECONDS ?? 28_800,
    rpcTransport: resolveRpcTransport(parsed.data.RPC_TRANSPORT),
    corsOrigins: normalizeCorsOrigins(parsed.data.CORS_ORIGINS),
    sentryDsn: parsed.data.SENTRY_DSN,
    maxBodyBytes: parsed.data.MAX_BODY_BYTES ?? 5 * 1024 * 1024,
    requestTimeoutMs: parsed.data.REQUEST_TIMEOUT_MS ?? 30_000,
    rateLimit: parsed.data.RATE_LIMIT ?? 300,
    rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_MS ?? 60_000,
  };
};
