import { createFactory } from 'hono/factory';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';

const factory = createFactory<TGatewayAppEnv>();

/** Catch-all HTTP driving adapter for the route-RPC application port. */
export const gatewayRpcHandlers = factory.createHandlers(async (c) =>
  c.get('requestScope').routeRpcRequest.execute({
    request: c.req.raw,
    requestId: c.get('requestId'),
  }),
);
