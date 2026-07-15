import { describe, expect, it } from 'vitest';
import { resolveFastifyLoggerOptions } from '@/platform/fastify/logger-options';

describe('resolveFastifyLoggerOptions', () => {
  it('should use readable Pino output in development', () => {
    expect(resolveFastifyLoggerOptions('development')).toEqual({
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:HH:MM:ss.l',
        },
      },
    });
  });

  it.each([
    'production',
    'staging',
    'test',
    'unexpected',
  ])('should keep structured JSON in %s', (nodeEnv) => {
    expect(resolveFastifyLoggerOptions(nodeEnv)).toBe(true);
  });
});
