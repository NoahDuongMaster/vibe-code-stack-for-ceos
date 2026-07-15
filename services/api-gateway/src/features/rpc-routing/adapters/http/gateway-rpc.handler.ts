import type { Context, Env, Handler } from 'hono';
import type { RouteRpcRequest } from '@/features/rpc-routing/application/route-rpc-request.port';

/** Catch-all HTTP driving adapter for the route-RPC application port. */
export const createGatewayRpcHandler = <TEnv extends Env>(
  resolveRouteRpcRequest: (
    context: Context<TEnv>,
  ) => RouteRpcRequest<Request, Response>,
  resolveRequestId: (context: Context<TEnv>) => string,
): Handler<TEnv> =>
  async function gatewayRpcHandler(c) {
    const requestId = resolveRequestId(c);
    const response = await resolveRouteRpcRequest(c).execute({
      request: c.req.raw,
      requestId,
    });
    response.headers.set('x-request-id', requestId);
    return response;
  };
