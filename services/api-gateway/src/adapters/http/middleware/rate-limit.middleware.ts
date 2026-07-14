import { createMiddleware } from 'hono/factory';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';
import { gatewayErrorResponse } from '@/adapters/http/gateway-error-handler';

/** HTTP adapter translating the rate-limit use-case decision into a 429. */
export const rateLimitMiddleware = createMiddleware<TGatewayAppEnv>(
  async (c, next) => {
    const { allowed } = await c.get('requestScope').enforceRateLimit.execute({
      pathname: c.req.path,
      clientIdentifier: c.req.header('cf-connecting-ip'),
      requestId: c.get('requestId'),
    });

    if (!allowed) {
      return gatewayErrorResponse(c, 429, 'rate_limited', 'Too Many Requests');
    }

    await next();
  },
);
