import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAPI } from '@/features/auth/adapters/auth.adapter';
import { AuthError } from '@/features/auth/errors/auth.error';
import type {
  TAuthSession,
  TLoginInput,
} from '@/features/auth/schemas/auth.schema';
import { authService } from '@/features/auth/services/auth.service';

// Mock the adapter (HTTP layer) — never the service under test.
vi.mock('@/features/auth/adapters/auth.adapter', () => ({
  loginAPI: vi.fn(),
}));

describe('authService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should delegate login() to the adapter with the given input', async () => {
    const input: TLoginInput = {
      email: 'admin@example.com',
      password: 'password',
    };
    const session: TAuthSession = {
      token: 'demo.token',
      user: { id: 'me', email: input.email, name: 'admin' },
    };
    vi.mocked(loginAPI).mockResolvedValue(session);

    await expect(authService.login(input)).resolves.toEqual(session);
    expect(loginAPI).toHaveBeenCalledWith(input);
  });

  it('should propagate AuthError from the adapter', async () => {
    const input: TLoginInput = {
      email: 'admin@example.com',
      password: 'password',
    };
    vi.mocked(loginAPI).mockRejectedValue(
      new AuthError('mock_auth_disabled', 'Sign-in is not configured.'),
    );

    await expect(authService.login(input)).rejects.toThrow(
      'Sign-in is not configured.',
    );
  });
});
