import type { AuthorizeGatewayRequest } from '@/application/authorize-gateway-request/authorize-gateway-request.port';
import type { EnforceRateLimit } from '@/application/enforce-rate-limit/enforce-rate-limit.port';
import type { RouteRpcRequest } from '@/application/route-rpc-request/route-rpc-request.port';

/** Per-request input ports assembled by the outer Cloudflare composition root. */
export interface GatewayRequestScope<TRequest, TResponse> {
  authorizeGatewayRequest: AuthorizeGatewayRequest;
  enforceRateLimit: EnforceRateLimit;
  routeRpcRequest: RouteRpcRequest<TRequest, TResponse>;
}
