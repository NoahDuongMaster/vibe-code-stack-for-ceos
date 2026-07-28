import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '@/config/runtime-config';
import { resolveRuntimeEnvironment } from '@/config/runtime-environment';

describe('resolveRuntimeEnvironment', () => {
  it('should prefer and trim the file-backed database URL', () => {
    const resolved = resolveRuntimeEnvironment(
      {
        SERVICE_NAME: 'trading-rpc',
        DATABASE_URL: '',
        DATABASE_URL_FILE: ' /run/secrets/trading-rpc-database-url ',
      },
      (path) => {
        expect(path).toBe('/run/secrets/trading-rpc-database-url');
        return '  postgresql://user:password@postgres:5432/trading_rpc\n';
      },
    );

    expect(resolved.DATABASE_URL).toBe(
      'postgresql://user:password@postgres:5432/trading_rpc',
    );
  });

  it('should resolve optional provider and telemetry secrets from files', () => {
    const resolved = resolveRuntimeEnvironment(
      {
        COINGECKO_API_KEY_FILE: '/run/secrets/coingecko-api-key',
        SENTRY_DSN_FILE: '/run/secrets/trading-sentry-dsn',
      },
      (path) =>
        path.endsWith('coingecko-api-key')
          ? ' demo-api-key\n'
          : ' https://key@sentry.example.com/2\n',
    );

    expect(resolved).toMatchObject({
      COINGECKO_API_KEY: 'demo-api-key',
      SENTRY_DSN: 'https://key@sentry.example.com/2',
    });
  });

  it('should preserve the direct environment when no file is configured', () => {
    const environment = {
      SERVICE_NAME: 'trading-rpc',
      DATABASE_URL: 'postgresql://direct:password@postgres/trading_rpc',
    };

    expect(
      resolveRuntimeEnvironment(environment, () => {
        throw new Error('file reader must not run');
      }),
    ).toBe(environment);
  });

  it('should propagate an unreadable runtime secret failure', () => {
    expect(() =>
      resolveRuntimeEnvironment(
        { DATABASE_URL_FILE: '/run/secrets/missing' },
        () => {
          throw new Error('EACCES');
        },
      ),
    ).toThrow('EACCES');
  });

  it('should produce an environment accepted by runtime validation', () => {
    const resolved = resolveRuntimeEnvironment(
      {
        SERVICE_NAME: 'trading-rpc',
        DATABASE_URL: '',
        DATABASE_URL_FILE: '/run/secrets/trading-rpc-database-url',
      },
      () => 'postgresql://user:password@postgres:5432/trading_rpc',
    );

    expect(() => parseRuntimeConfig(resolved)).not.toThrow();
  });
});
