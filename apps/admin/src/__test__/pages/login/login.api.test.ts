import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '@/pages/login/api/login.api';

const config = vi.hoisted(() => ({ enableMockAuth: true }));

vi.mock('@/shared/config', () => ({
  get ENABLE_MOCK_AUTH() {
    return config.enableMockAuth;
  },
}));

describe('login', () => {
  beforeEach(() => {
    config.enableMockAuth = true;
  });

  it('should create a demo session when mock auth is enabled', async () => {
    const session = await login({
      email: 'admin@example.com',
      password: 'password',
    });

    expect(session).toMatchObject({
      user: { id: 'me', email: 'admin@example.com', name: 'admin' },
    });
    expect(session.token).toContain('demo.');
  });

  it('should reject sign-in when mock auth is disabled', async () => {
    config.enableMockAuth = false;

    await expect(
      login({ email: 'admin@example.com', password: 'password' }),
    ).rejects.toHaveProperty('code', 'mock_auth_disabled');
  });
});
