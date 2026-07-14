import { createMiddleware } from 'hono/factory';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';
import type { GatewayRequestScopeFactory } from '@/adapters/http/gateway-request-scope.factory';

/** Builds a request-scoped hexagonal dependency graph from Worker bindings. */
export const createRequestScopeMiddleware = (
  factory: GatewayRequestScopeFactory,
) =>
  createMiddleware<TGatewayAppEnv>(async (c, next) => {
    c.set('requestScope', factory(c.env, c.get('runtimeConfig')));
    await next();
  });
