import { createMiddleware } from 'hono/factory';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';

const roundDuration = (durationMs: number): number =>
  Math.round(durationMs * 100) / 100;

/** Emits metadata-only access logs after Hono has finalized the response. */
export const requestLoggingMiddleware = createMiddleware<TGatewayAppEnv>(
  async (c, next) => {
    const startedAt = performance.now();
    await next();

    c.get('requestScope').logger.info({
      event: 'request_completed',
      durationMs: roundDuration(performance.now() - startedAt),
      method: c.req.method,
      pathname: c.req.path,
      requestId: c.get('requestId'),
      statusCode: c.res.status,
    });
  },
);
