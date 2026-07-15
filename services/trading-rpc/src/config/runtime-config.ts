import { z } from 'zod';
import { type RpcTransport, resolveRpcTransport } from '@/infra/rpc-transport';

export interface TRuntimeConfig {
  serviceName: string;
  databaseUrl: string;
  databasePoolMax: number;
  databaseConnectionTimeoutMs: number;
  databaseIdleTimeoutMs: number;
  nodeEnv: string;
  port: number;
  grpcPort: number;
  rpcTransport: RpcTransport;
  corsOrigins: string[];
  coingeckoApiKey?: string;
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

const ZRuntimeEnvironment = z.object({
  SERVICE_NAME: z.string().trim().min(1),
  DATABASE_URL: z.string().trim().url(),
  DATABASE_POOL_MAX: ZOptionalPositiveInteger,
  DATABASE_CONNECTION_TIMEOUT_MS: ZOptionalPositiveInteger,
  DATABASE_IDLE_TIMEOUT_MS: ZOptionalPositiveInteger,
  NODE_ENV: ZOptionalString,
  PORT: ZOptionalPositiveInteger,
  GRPC_PORT: ZOptionalPositiveInteger,
  RPC_TRANSPORT: z.preprocess(
    normalizeOptionalString,
    z.enum(['http1', 'http2']).optional(),
  ),
  CORS_ORIGINS: ZOptionalString,
  COINGECKO_API_KEY: ZOptionalString,
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

/**
 * Parses only values supplied by the composition root. This module must never
 * read process.env itself so it remains deterministic and unit-testable.
 */
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
    databaseUrl: parsed.data.DATABASE_URL,
    databasePoolMax: parsed.data.DATABASE_POOL_MAX ?? 10,
    databaseConnectionTimeoutMs:
      parsed.data.DATABASE_CONNECTION_TIMEOUT_MS ?? 5_000,
    databaseIdleTimeoutMs: parsed.data.DATABASE_IDLE_TIMEOUT_MS ?? 30_000,
    nodeEnv: parsed.data.NODE_ENV ?? 'development',
    port: parsed.data.PORT ?? 3001,
    grpcPort: parsed.data.GRPC_PORT ?? 50051,
    rpcTransport: resolveRpcTransport(parsed.data.RPC_TRANSPORT),
    corsOrigins: normalizeCorsOrigins(parsed.data.CORS_ORIGINS),
    coingeckoApiKey: parsed.data.COINGECKO_API_KEY,
    sentryDsn: parsed.data.SENTRY_DSN,
    maxBodyBytes: parsed.data.MAX_BODY_BYTES ?? 5 * 1024 * 1024,
    requestTimeoutMs: parsed.data.REQUEST_TIMEOUT_MS ?? 30_000,
    rateLimit: parsed.data.RATE_LIMIT ?? 300,
    rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_MS ?? 60_000,
  };
};
