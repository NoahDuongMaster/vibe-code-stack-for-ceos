import { z } from 'zod';

export type TGatewayEnvironment = 'development' | 'staging' | 'production';

export interface TGatewayRuntimeBindingValues {
  SERVICE_NAME: string;
  ENVIRONMENT?: TGatewayEnvironment;
  CORS_ORIGINS?: string;
  JWT_SECRET?: string;
}

const ZGatewayRuntimeBindings = z
  .object({
    SERVICE_NAME: z.string().trim().min(1),
    ENVIRONMENT: z.enum(['development', 'staging', 'production']).optional(),
    CORS_ORIGINS: z.string().optional(),
    JWT_SECRET: z.string().optional(),
  })
  .passthrough();

export interface TGatewayRuntimeConfig {
  serviceName: string;
  environment: TGatewayEnvironment;
  corsOrigins: readonly string[];
  jwtSecret: string | undefined;
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
  const corsOrigins = normalizeCorsOrigins(input.CORS_ORIGINS);
  const jwtSecret = input.JWT_SECRET || undefined;

  if (environment !== 'development') {
    if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
      throw new Error(
        'CORS_ORIGINS must contain an explicit allow-list outside development',
      );
    }
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error(
        'JWT_SECRET must contain at least 32 characters outside development',
      );
    }
  }

  return {
    serviceName: input.SERVICE_NAME,
    environment,
    corsOrigins,
    jwtSecret,
  };
};
