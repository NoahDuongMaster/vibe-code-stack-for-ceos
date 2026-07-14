import type {
  GatewayLogEvent,
  GatewayLogger,
} from '@/application/shared/gateway-logger.port';

const serializeLogEvent = (
  level: 'error' | 'warn',
  event: GatewayLogEvent,
): string =>
  JSON.stringify({
    service: 'api-gateway',
    level,
    ...event,
  });

/** Cloudflare log adapter that never serializes request bodies or error text. */
export const consoleGatewayLogger: GatewayLogger = {
  error(event: GatewayLogEvent): void {
    console.error(serializeLogEvent('error', event));
  },
  warning(event: GatewayLogEvent): void {
    console.warn(serializeLogEvent('warn', event));
  },
};
