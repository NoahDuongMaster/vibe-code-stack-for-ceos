import { cors } from 'hono/cors';
import { createFactory } from 'hono/factory';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';
import { createGatewayErrorHandler } from '@/adapters/http/gateway-error-handler';
import type { GatewayRequestScopeFactory } from '@/adapters/http/gateway-request-scope.factory';
import { gatewayRpcHandlers } from '@/adapters/http/gateway-rpc.handler';
import { authMiddleware } from '@/adapters/http/middleware/auth.middleware';
import { rateLimitMiddleware } from '@/adapters/http/middleware/rate-limit.middleware';
import { createRequestScopeMiddleware } from '@/adapters/http/middleware/request-scope.middleware';
import { runtimeConfigMiddleware } from '@/adapters/http/middleware/runtime-config.middleware';
import type { GatewayLogger } from '@/application/shared/gateway-logger.port';
import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
} from '@/config/gateway-options';

const factory = createFactory<TGatewayAppEnv>();

const SECURE_HEADERS_OPTIONS = {
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
} as const;

export interface GatewayAppDependencies {
  logger: GatewayLogger;
  requestScopeFactory: GatewayRequestScopeFactory;
}

/** Hono inbound adapter; all use cases and driven ports arrive by injection. */
export const createGatewayApp = (dependencies: GatewayAppDependencies) => {
  const app = factory.createApp();

  app.onError(createGatewayErrorHandler(dependencies.logger));
  app.use('*', requestId());
  app.use('*', secureHeaders(SECURE_HEADERS_OPTIONS));
  app.use('*', runtimeConfigMiddleware);
  app.use('*', createRequestScopeMiddleware(dependencies.requestScopeFactory));
  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const { corsOrigins } = c.get('runtimeConfig');
        if (corsOrigins.includes('*')) return origin;
        return corsOrigins.includes(origin) ? origin : null;
      },
      allowHeaders: [...CORS_ALLOWED_HEADERS],
      allowMethods: [...CORS_ALLOWED_METHODS],
      maxAge: 86400,
    }),
  );
  app.use('*', rateLimitMiddleware);
  app.use('*', authMiddleware);

  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  app.all('*', ...gatewayRpcHandlers);

  return app;
};

export type GatewayApp = ReturnType<typeof createGatewayApp>;
