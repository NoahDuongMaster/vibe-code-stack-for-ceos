import { afterEach, describe, expect, it, vi } from 'vitest';

const stubRequiredEnvironment = () => {
  vi.stubEnv('NEXT_PUBLIC_PROJECT_NAME', 'test-project');
  vi.stubEnv('NEXT_PUBLIC_API_ENDPOINT', 'http://localhost:8787');
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://example.com');
  vi.stubEnv('SESSION_SECRET', 'test-session-secret-with-at-least-32-chars');
  vi.stubEnv('DEMO_AUTH_EMAIL', 'test@example.com');
  vi.stubEnv('DEMO_AUTH_PASSWORD', 'test-password');
};

describe('[EnvironmentConfiguration]', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should reject missing required values even when the legacy skip flag is set', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubRequiredEnvironment();
    vi.stubEnv('NEXT_PUBLIC_PROJECT_NAME', '');
    vi.stubEnv('SKIP_ENV_VALIDATION', 'true');
    vi.resetModules();

    await expect(import('@/shared/config/env')).rejects.toThrow(
      'Invalid environment variables',
    );
  });

  it('should reject an empty API Gateway endpoint', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubRequiredEnvironment();
    vi.stubEnv('NEXT_PUBLIC_API_ENDPOINT', '');
    vi.resetModules();

    await expect(import('@/shared/config/env')).rejects.toThrow(
      'Invalid environment variables',
    );
  });
});
