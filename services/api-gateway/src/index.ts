import type { TGatewayBindings } from '@/adapters/cloudflare/gateway-bindings';
import { createGatewayApp } from '@/adapters/http/gateway-app';
import type { GatewayRequestScopeFactory } from '@/adapters/http/gateway-request-scope.factory';
import {
  PUBLIC_PATHS,
  RATE_LIMIT_POLICY,
  TRADING_RPC_ORIGIN,
  UPSTREAM_TIMEOUT_MS,
} from '@/config/gateway-options';
import {
  AuthorizeGatewayRequestUseCase,
  honoJwtTokenVerifier,
} from '@/features/access-control';
import {
  createDurableObjectRateLimiterAdapter,
  EnforceRateLimitUseCase,
  RateLimitPolicy,
} from '@/features/rate-limiting';
import {
  createCloudflareTradingRpcAdapter,
  createLocalApiCoreAdapter,
  RouteRpcRequestUseCase,
} from '@/features/rpc-routing';
import { GatewayAccessPolicy } from '@/shared/access-policy';
import { createConsoleGatewayLogger } from '@/shared/logging';

export { RateLimiterDO } from '@/features/rate-limiting';

const accessPolicy = new GatewayAccessPolicy(PUBLIC_PATHS);
const rateLimitPolicy = RateLimitPolicy.create(RATE_LIMIT_POLICY);

const requireTradingRpcBinding = (bindings: TGatewayBindings): Fetcher => {
  if (!bindings.TRADING_RPC) {
    throw new Error('TRADING_RPC VPC Service binding is required');
  }

  return bindings.TRADING_RPC;
};

const createRequestScope: GatewayRequestScopeFactory = (bindings, config) => {
  const logger = createConsoleGatewayLogger(
    config.serviceName,
    config.environment === 'development' ? 'pretty' : 'json',
  );
  const tradingRpc = requireTradingRpcBinding(bindings);

  return {
    logger,
    authorizeGatewayRequest: new AuthorizeGatewayRequestUseCase(
      accessPolicy,
      honoJwtTokenVerifier,
      config.jwtSecret,
    ),
    enforceRateLimit: new EnforceRateLimitUseCase(
      accessPolicy,
      createDurableObjectRateLimiterAdapter(bindings.RATE_LIMITER),
      rateLimitPolicy,
      logger,
    ),
    routeRpcRequest: new RouteRpcRequestUseCase(
      createLocalApiCoreAdapter(config.serviceName),
      createCloudflareTradingRpcAdapter({
        origin: TRADING_RPC_ORIGIN,
        target: tradingRpc,
        timeoutMs: UPSTREAM_TIMEOUT_MS,
      }),
    ),
  };
};

/** Cloudflare Worker composition root. */
export const createGatewayWorker = () =>
  createGatewayApp({
    requestScopeFactory: createRequestScope,
  });

export default createGatewayWorker();
