import type { Context, Env } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AuthorizeGatewayRequest } from '@/features/access-control/application/authorize-gateway-request.port';

/** HTTP adapter translating the authorization use-case decision into a 401. */
export const createAuthMiddleware = <TEnv extends Env>(
  resolveAuthorize: (context: Context<TEnv>) => AuthorizeGatewayRequest,
) =>
  createMiddleware<TEnv>(async (c, next) => {
    const { allowed } = await resolveAuthorize(c).execute({
      pathname: c.req.path,
      authorizationHeader: c.req.header('authorization'),
    });

    if (!allowed) {
      return c.json(
        {
          error: {
            code: 'unauthorized',
            message: 'Invalid or missing token',
          },
        },
        401,
      );
    }

    await next();
  });
