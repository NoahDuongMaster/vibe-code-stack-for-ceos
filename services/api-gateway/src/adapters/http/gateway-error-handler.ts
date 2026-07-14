import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';
import type { GatewayLogger } from '@/application/shared/gateway-logger.port';
import {
  UpstreamTimeoutError,
  UpstreamUnavailableError,
} from '@/domain/routing/errors';

export type GatewayErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'bad_gateway'
  | 'upstream_timeout'
  | 'internal';

export const gatewayErrorResponse = (
  c: Context<TGatewayAppEnv>,
  status: ContentfulStatusCode,
  code: GatewayErrorCode,
  message: string,
): Response => c.json({ error: { code, message } }, status);

/** Inbound adapter mapping typed domain/application failures onto safe HTTP. */
export const createGatewayErrorHandler =
  (logger: GatewayLogger) =>
  (error: Error, c: Context<TGatewayAppEnv>): Response => {
    logger.error({
      event: 'request_error',
      errorName: error.name,
      method: c.req.method,
      pathname: c.req.path,
      requestId: c.get('requestId'),
    });

    if (error instanceof UpstreamTimeoutError) {
      return gatewayErrorResponse(
        c,
        504,
        'upstream_timeout',
        'Upstream Timeout',
      );
    }

    if (error instanceof UpstreamUnavailableError) {
      return gatewayErrorResponse(c, 502, 'bad_gateway', 'Bad Gateway');
    }

    if (error instanceof HTTPException && error.status === 401) {
      return gatewayErrorResponse(
        c,
        401,
        'unauthorized',
        'Invalid or missing token',
      );
    }

    return gatewayErrorResponse(c, 500, 'internal', 'Internal Server Error');
  };
