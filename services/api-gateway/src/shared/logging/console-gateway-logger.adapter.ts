import type {
  GatewayLogEvent,
  GatewayLogger,
} from '@/shared/logging/gateway-logger.port';

export type GatewayLogFormat = 'json' | 'pretty';

type GatewayLogLevel = 'error' | 'info' | 'warn';

const serializeLogEvent = (
  serviceName: string,
  level: GatewayLogLevel,
  event: GatewayLogEvent,
): string =>
  JSON.stringify({
    timestamp: new Date().toISOString(),
    service: serviceName,
    level,
    ...event,
  });

const requestIdLabel = (requestId: string | undefined): string =>
  `requestId=${requestId ?? '-'}`;

const formatEventSummary = (event: GatewayLogEvent): string => {
  switch (event.event) {
    case 'request_completed':
      return `${event.method} ${event.pathname} ${event.statusCode} ${event.durationMs}ms ${requestIdLabel(event.requestId)}`;
    case 'request_error':
      return `${event.method} ${event.pathname} failed error=${event.errorName} ${requestIdLabel(event.requestId)}`;
    case 'rate_limiter_unavailable':
      return `rate limiter unavailable error=${event.errorName} ${requestIdLabel(event.requestId)}`;
  }
};

const formatPrettyLogEvent = (
  serviceName: string,
  level: GatewayLogLevel,
  event: GatewayLogEvent,
): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${level.toUpperCase().padEnd(5)} [${serviceName}] ${formatEventSummary(event)}`;
};

const formatLogEvent = (
  serviceName: string,
  format: GatewayLogFormat,
  level: GatewayLogLevel,
  event: GatewayLogEvent,
): string =>
  format === 'pretty'
    ? formatPrettyLogEvent(serviceName, level, event)
    : serializeLogEvent(serviceName, level, event);

/** Cloudflare log adapter that never serializes request bodies or error text. */
export const createConsoleGatewayLogger = (
  serviceName: string,
  format: GatewayLogFormat,
): GatewayLogger => ({
  error(event: GatewayLogEvent): void {
    console.error(formatLogEvent(serviceName, format, 'error', event));
  },
  info(event: GatewayLogEvent): void {
    console.info(formatLogEvent(serviceName, format, 'info', event));
  },
  warning(event: GatewayLogEvent): void {
    console.warn(formatLogEvent(serviceName, format, 'warn', event));
  },
});
