import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('session production placeholder guard', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/shared/config');
    vi.unstubAllEnvs();
  });

  it('should throw at import time when the production secret is the public placeholder', async () => {
    vi.doMock('@/shared/config', () => ({
      env: {
        server: { SESSION_SECRET: 'dev-session-secret-min-32-chars!!' },
      },
    }));
    vi.stubEnv('NODE_ENV', 'production');

    await expect(
      import('@/entities/session/api/session.server'),
    ).rejects.toThrow(/SESSION_SECRET/);
  });

  it('should load in production when the session secret is not the placeholder', async () => {
    vi.doMock('@/shared/config', () => ({
      env: {
        server: { SESSION_SECRET: 'a-real-generated-session-secret-value' },
      },
    }));
    vi.stubEnv('NODE_ENV', 'production');

    await expect(
      import('@/entities/session/api/session.server'),
    ).resolves.toBeDefined();
  });
});
