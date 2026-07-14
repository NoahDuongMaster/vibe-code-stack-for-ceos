import { z } from 'zod';

export type TGatewayEnvironment = 'development' | 'staging' | 'production';

export interface TGatewayRuntimeBindingValues {
  ENVIRONMENT?: TGatewayEnvironment;
  LOCAL_TRADING_RPC_URL?: string;
  CORS_ORIGINS?: string;
  JWT_SECRET?: string;
}

const ZGatewayRuntimeBindings = z
  .object({
    ENVIRONMENT: z.enum(['development', 'staging', 'production']).optional(),
    CORS_ORIGINS: z.string().optional(),
    LOCAL_TRADING_RPC_URL: z.string().optional(),
    JWT_SECRET: z.string().optional(),
  })
  .passthrough();

export interface TGatewayRuntimeConfig {
  environment: TGatewayEnvironment;
  corsOrigins: readonly string[];
  jwtSecret: string | undefined;
  localTradingRpcOrigin: string | undefined;
}

const isHttpProtocol = (protocol: string): boolean =>
  protocol === 'http:' || protocol === 'https:';

const normalizeCorsOrigin = (value: string): string => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('CORS_ORIGINS contains an invalid origin');
  }

  if (
    !isHttpProtocol(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('CORS_ORIGINS contains an invalid origin');
  }

  return url.origin;
};

const normalizeCorsOrigins = (
  rawOrigins: string | undefined,
): readonly string[] => {
  const origins =
    rawOrigins
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  if (origins.includes('*')) {
    if (origins.length !== 1) {
      throw new Error('CORS_ORIGINS wildcard must be used alone');
    }

    return ['*'];
  }

  return [...new Set(origins.map(normalizeCorsOrigin))];
};

const parseLocalTradingRpcOrigin = (
  rawUrl: string | undefined,
): string | undefined => {
  if (!rawUrl) return undefined;

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('LOCAL_TRADING_RPC_URL must be a valid HTTP origin');
  }

  if (
    !isHttpProtocol(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('LOCAL_TRADING_RPC_URL must be a valid HTTP origin');
  }

  return url.origin;
};

/**
 * Validates Worker bindings at the request boundary. Deployment configuration
 * is still owned by wrangler, while this parser prevents malformed values from
 * changing routing, auth, or browser-origin behavior at runtime.
 */
export const parseGatewayRuntimeConfig = (
  bindings: TGatewayRuntimeBindingValues,
): TGatewayRuntimeConfig => {
  const input = ZGatewayRuntimeBindings.parse(bindings);
  const environment = input.ENVIRONMENT ?? 'production';

  return {
    environment,
    corsOrigins: normalizeCorsOrigins(input.CORS_ORIGINS),
    jwtSecret: input.JWT_SECRET || undefined,
    localTradingRpcOrigin:
      environment === 'development'
        ? parseLocalTradingRpcOrigin(input.LOCAL_TRADING_RPC_URL)
        : undefined,
  };
};
