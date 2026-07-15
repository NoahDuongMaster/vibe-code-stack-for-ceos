import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConsoleGatewayLogger } from '@/shared/logging/console-gateway-logger.adapter';

const REQUEST_COMPLETED_EVENT = {
  event: 'request_completed',
  durationMs: 42.31,
  method: 'POST',
  pathname: '/trading.v1.TradingService/GetMarkets',
  requestId: 'abc-123',
  statusCode: 200,
} as const;

describe('createConsoleGatewayLogger', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should render one readable access-log line in development', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T05:34:56.789Z'));
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const logger = createConsoleGatewayLogger('api-gateway', 'pretty');
    logger.info(REQUEST_COMPLETED_EVENT);

    expect(infoSpy).toHaveBeenCalledWith(
      '[2026-07-15T05:34:56.789Z] INFO  [api-gateway] POST /trading.v1.TradingService/GetMarkets 200 42.31ms requestId=abc-123',
    );
  });

  it('should preserve structured JSON access logs outside development', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T05:34:56.789Z'));
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const logger = createConsoleGatewayLogger('api-gateway', 'json');
    logger.info(REQUEST_COMPLETED_EVENT);

    expect(infoSpy).toHaveBeenCalledOnce();
    expect(JSON.parse(String(infoSpy.mock.calls[0]?.[0]))).toEqual({
      timestamp: '2026-07-15T05:34:56.789Z',
      service: 'api-gateway',
      level: 'info',
      ...REQUEST_COMPLETED_EVENT,
    });
  });
});
