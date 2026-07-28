import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '@/config/runtime-config';
import { resolveRuntimeEnvironment } from '@/config/runtime-environment';

describe('resolveRuntimeEnvironment', () => {
  it('should resolve every configured file-backed secret', () => {
    const values: Record<string, string> = {
      '/run/secrets/admin-auth-email': ' admin@example.com\n',
      '/run/secrets/admin-auth-password': 'strong-admin-password\n',
      '/run/secrets/jwt-secret': 'a'.repeat(32),
      '/run/secrets/admin-sentry-dsn': ' https://key@sentry.example.com/1\n',
    };

    const resolved = resolveRuntimeEnvironment(
      {
        ADMIN_AUTH_EMAIL_FILE: '/run/secrets/admin-auth-email',
        ADMIN_AUTH_PASSWORD_FILE: '/run/secrets/admin-auth-password',
        JWT_SECRET_FILE: '/run/secrets/jwt-secret',
        SENTRY_DSN_FILE: '/run/secrets/admin-sentry-dsn',
      },
      (path) => values[path] ?? '',
    );

    expect(resolved).toMatchObject({
      ADMIN_AUTH_EMAIL: 'admin@example.com',
      ADMIN_AUTH_PASSWORD: 'strong-admin-password',
      JWT_SECRET: 'a'.repeat(32),
      SENTRY_DSN: 'https://key@sentry.example.com/1',
    });
  });

  it('should preserve the direct environment when no file is configured', () => {
    const environment = { ADMIN_AUTH_EMAIL: 'admin@example.com' };
    expect(
      resolveRuntimeEnvironment(environment, () => {
        throw new Error('file reader must not run');
      }),
    ).toBe(environment);
  });

  it('should propagate unreadable secret failures', () => {
    expect(() =>
      resolveRuntimeEnvironment(
        { JWT_SECRET_FILE: '/run/secrets/missing' },
        () => {
          throw new Error('EACCES');
        },
      ),
    ).toThrow('EACCES');
  });

  it('should produce an environment accepted by runtime validation', () => {
    const resolved = resolveRuntimeEnvironment(
      {
        SERVICE_NAME: 'admin-rpc',
        TRADING_RPC_GRPC_URL: 'http://trading-rpc:50051',
        ADMIN_AUTH_EMAIL_FILE: '/run/secrets/admin-auth-email',
        ADMIN_AUTH_PASSWORD_FILE: '/run/secrets/admin-auth-password',
        JWT_SECRET_FILE: '/run/secrets/jwt-secret',
      },
      (path) => {
        if (path.endsWith('email')) return 'admin@example.com';
        if (path.endsWith('password')) return 'strong-admin-password';
        return 'a'.repeat(32);
      },
    );

    expect(() => parseRuntimeConfig(resolved)).not.toThrow();
  });
});
