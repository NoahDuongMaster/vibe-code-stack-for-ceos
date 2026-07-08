import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authAdapter from '@/features/auth/adapters/auth.adapter';
import { authService } from '@/features/auth/services/auth.service';

vi.mock('@/features/auth/adapters/auth.adapter');

describe('authService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should delegate getSession() to getSessionAPI()', async () => {
    const session = {
      isLoggedIn: true,
      user: { id: '1', email: 'demo@example.com' },
    };
    vi.mocked(authAdapter.getSessionAPI).mockResolvedValue(session);

    await expect(authService.getSession()).resolves.toEqual(session);
    expect(authAdapter.getSessionAPI).toHaveBeenCalledOnce();
  });

  it('should delegate login() to loginAPI() with the given input', async () => {
    vi.mocked(authAdapter.loginAPI).mockResolvedValue(undefined);
    const input = { email: 'demo@example.com', password: 'secret' };

    await authService.login(input);

    expect(authAdapter.loginAPI).toHaveBeenCalledExactlyOnceWith(input);
  });

  it('should propagate errors thrown by loginAPI()', async () => {
    const error = new Error('boom');
    vi.mocked(authAdapter.loginAPI).mockRejectedValue(error);

    await expect(
      authService.login({ email: 'demo@example.com', password: 'secret' }),
    ).rejects.toThrow(error);
  });
});
