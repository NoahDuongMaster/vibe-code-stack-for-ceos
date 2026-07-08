import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'correct-horse-battery-staple';

vi.mock('@/shared/config/env.configuration', () => ({
  env: {
    server: {
      DEMO_AUTH_EMAIL: 'demo@example.com',
      DEMO_AUTH_PASSWORD: 'correct-horse-battery-staple',
    },
  },
}));

describe('server/lib/auth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('verifyCredentials', () => {
    it('should return the demo user when email and password match', async () => {
      const { verifyCredentials } = await import('@/server/lib/auth');

      await expect(
        verifyCredentials(DEMO_EMAIL, DEMO_PASSWORD),
      ).resolves.toEqual({
        id: 'demo-user',
        email: DEMO_EMAIL,
        name: 'Demo User',
      });
    });

    it('should match email case-insensitively', async () => {
      const { verifyCredentials } = await import('@/server/lib/auth');

      await expect(
        verifyCredentials('DEMO@EXAMPLE.COM', DEMO_PASSWORD),
      ).resolves.not.toBeNull();
    });

    it('should return null when the password is wrong', async () => {
      const { verifyCredentials } = await import('@/server/lib/auth');

      await expect(
        verifyCredentials(DEMO_EMAIL, 'wrong-password'),
      ).resolves.toBeNull();
    });

    it('should return null when the email is wrong', async () => {
      const { verifyCredentials } = await import('@/server/lib/auth');

      await expect(
        verifyCredentials('someone-else@example.com', DEMO_PASSWORD),
      ).resolves.toBeNull();
    });
  });

  describe('production placeholder guard', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it.each([
      'change-me-please',
      'build-time-placeholder',
    ])('should throw at import time if DEMO_AUTH_PASSWORD is still the known placeholder %s in production', async (placeholder) => {
      vi.doMock('@/shared/config/env.configuration', () => ({
        env: {
          server: {
            DEMO_AUTH_EMAIL: 'admin@example.com',
            DEMO_AUTH_PASSWORD: placeholder,
          },
        },
      }));
      vi.stubEnv('NODE_ENV', 'production');

      await expect(import('@/server/lib/auth')).rejects.toThrow(
        /DEMO_AUTH_PASSWORD/,
      );
    });

    it('should NOT throw in production when DEMO_AUTH_PASSWORD is a real value', async () => {
      vi.doMock('@/shared/config/env.configuration', () => ({
        env: {
          server: {
            DEMO_AUTH_EMAIL: DEMO_EMAIL,
            DEMO_AUTH_PASSWORD: 'a-real-generated-secret',
          },
        },
      }));
      vi.stubEnv('NODE_ENV', 'production');

      await expect(import('@/server/lib/auth')).resolves.toBeDefined();
    });
  });
});
