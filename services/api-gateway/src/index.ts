import { createGatewayApp } from '@/adapters/http/gateway-app';
import type { GatewayRequestScopeFactory } from '@/adapters/http/gateway-request-scope.factory';
import { AuthorizeGatewayRequestUseCase } from '@/application/authorize-gateway-request/authorize-gateway-request.use-case';
import { EnforceRateLimitUseCase } from '@/application/enforce-rate-limit/enforce-rate-limit.use-case';
import { RouteRpcRequestUseCase } from '@/application/route-rpc-request/route-rpc-request.use-case';
import {
  PUBLIC_PATHS,
  RATE_LIMIT_POLICY,
  TRADING_RPC_ORIGIN,
  UPSTREAM_TIMEOUT_MS,
} from '@/config/gateway-options';
import { GatewayAccessPolicy } from '@/domain/access-control/gateway-access-policy';
import { RateLimitPolicy } from '@/domain/rate-limiting/rate-limit-policy';
import { honoJwtTokenVerifier } from '@/infra/auth/hono-jwt-token-verifier.adapter';
import { consoleGatewayLogger } from '@/infra/logging/console-gateway-logger.adapter';
import { createDurableObjectRateLimiterAdapter } from '@/infra/rate-limiting/durable-object-rate-limiter.adapter';
import { createCloudflareTradingRpcAdapter } from '@/infra/rpc/cloudflare-trading-rpc.adapter';
import { localApiCoreAdapter } from '@/infra/rpc/local-api-core.adapter';

export { RateLimiterDO } from '@/infra/rate-limiting/rate-limiter.do';

const accessPolicy = new GatewayAccessPolicy(PUBLIC_PATHS);
const rateLimitPolicy = RateLimitPolicy.create(RATE_LIMIT_POLICY);

const createRequestScope: GatewayRequestScopeFactory = (bindings, config) => {
  const tradingTarget = bindings.TRADING_RPC
    ? {
        origin: TRADING_RPC_ORIGIN,
        target: bindings.TRADING_RPC,
      }
    : config.localTradingRpcOrigin
      ? {
          origin: config.localTradingRpcOrigin,
          target: { fetch: globalThis.fetch.bind(globalThis) },
        }
      : undefined;

  return {
    authorizeGatewayRequest: new AuthorizeGatewayRequestUseCase(
      accessPolicy,
      honoJwtTokenVerifier,
      config.jwtSecret,
    ),
    enforceRateLimit: new EnforceRateLimitUseCase(
      accessPolicy,
      createDurableObjectRateLimiterAdapter(bindings.RATE_LIMITER),
      rateLimitPolicy,
      consoleGatewayLogger,
    ),
    routeRpcRequest: new RouteRpcRequestUseCase(
      localApiCoreAdapter,
      tradingTarget
        ? createCloudflareTradingRpcAdapter({
            ...tradingTarget,
            timeoutMs: UPSTREAM_TIMEOUT_MS,
          })
        : undefined,
    ),
  };
};

/** Cloudflare Worker composition root. */
export const createGatewayWorker = () =>
  createGatewayApp({
    logger: consoleGatewayLogger,
    requestScopeFactory: createRequestScope,
  });

export default createGatewayWorker();
