import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '@/screens/login/api/login.api';

const { loginMock, loggerErrorMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  authApiClient: { login: loginMock },
}));

vi.mock('@/shared/lib/logger', () => ({
  logger: { error: loggerErrorMock },
}));

describe('[login]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the validated backend session', async () => {
    loginMock.mockResolvedValue({
      token: 'signed-token',
      user: { id: 'admin', email: 'admin@example.com', name: 'Administrator' },
    });

    await expect(
      login({ email: 'admin@example.com', password: 'valid-password' }),
    ).resolves.toEqual({
      token: 'signed-token',
      user: { id: 'admin', email: 'admin@example.com', name: 'Administrator' },
    });
  });

  it('should map an unauthenticated response to invalid credentials', async () => {
    loginMock.mockRejectedValue(
      new ConnectError('invalid credentials', Code.Unauthenticated),
    );

    await expect(
      login({ email: 'admin@example.com', password: 'wrong-password' }),
    ).rejects.toHaveProperty('code', 'invalid_credentials');
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('should log and sanitize service or response failures', async () => {
    const internalError = new Error('database host leaked');
    loginMock.mockRejectedValue(internalError);

    await expect(
      login({ email: 'admin@example.com', password: 'valid-password' }),
    ).rejects.toMatchObject({
      code: 'service_unavailable',
      message: 'Authentication is temporarily unavailable.',
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Authentication request failed',
      internalError,
    );
  });
});
