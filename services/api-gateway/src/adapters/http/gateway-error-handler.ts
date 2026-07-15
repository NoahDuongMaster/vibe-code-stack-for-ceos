import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';
import {
  UpstreamTimeoutError,
  UpstreamUnavailableError,
} from '@/features/rpc-routing';
import type { GatewayLogEvent } from '@/shared/logging';

export type GatewayErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'bad_gateway'
  | 'upstream_timeout'
  | 'internal';

const gatewayErrorResponse = (
  c: Context<TGatewayAppEnv>,
  status: ContentfulStatusCode,
  code: GatewayErrorCode,
  message: string,
): Response => c.json({ error: { code, message } }, status);

/** Inbound adapter mapping typed domain/application failures onto safe HTTP. */
export const createGatewayErrorHandler = () =>
  function gatewayErrorHandler(
    error: Error,
    c: Context<TGatewayAppEnv>,
  ): Response {
    const event: GatewayLogEvent = {
      event: 'request_error',
      errorName: error.name,
      method: c.req.method,
      pathname: c.req.path,
      requestId: c.get('requestId'),
    };
    const logger = c.get('requestScope')?.logger;
    if (logger) {
      logger.error(event);
    } else {
      console.error(JSON.stringify({ level: 'error', ...event }));
    }

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
