import { createMiddleware } from 'hono/factory';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';
import { gatewayErrorResponse } from '@/adapters/http/gateway-error-handler';

/** HTTP adapter translating the authorization use-case decision into a 401. */
export const authMiddleware = createMiddleware<TGatewayAppEnv>(
  async (c, next) => {
    const { allowed } = await c
      .get('requestScope')
      .authorizeGatewayRequest.execute({
        pathname: c.req.path,
        authorizationHeader: c.req.header('authorization'),
      });

    if (!allowed) {
      return gatewayErrorResponse(
        c,
        401,
        'unauthorized',
        'Invalid or missing token',
      );
    }

    await next();
  },
);
