import type { AuthorizeGatewayRequest } from '@/features/access-control';
import type { EnforceRateLimit } from '@/features/rate-limiting';
import type { RouteRpcRequest } from '@/features/rpc-routing';
import type { GatewayLogger } from '@/shared/logging';

/** Per-request input ports assembled by the outer Cloudflare composition root. */
export interface GatewayRequestScope<TRequest, TResponse> {
  logger: GatewayLogger;
  authorizeGatewayRequest: AuthorizeGatewayRequest;
  enforceRateLimit: EnforceRateLimit;
  routeRpcRequest: RouteRpcRequest<TRequest, TResponse>;
}
