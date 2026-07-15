import type { Context, Env } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { EnforceRateLimit } from '@/features/rate-limiting/application/enforce-rate-limit/enforce-rate-limit.port';

/** HTTP adapter translating the rate-limit use-case decision into a 429. */
export const createRateLimitMiddleware = <TEnv extends Env>(
  resolveRateLimit: (context: Context<TEnv>) => EnforceRateLimit,
) =>
  createMiddleware<TEnv>(async (c, next) => {
    const { allowed } = await resolveRateLimit(c).execute({
      pathname: c.req.path,
      clientIdentifier: c.req.header('cf-connecting-ip'),
      requestId: c.get('requestId'),
    });

    if (!allowed) {
      return c.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Too Many Requests',
          },
        },
        429,
      );
    }

    await next();
  });
