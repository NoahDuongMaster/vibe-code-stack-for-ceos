import { Code, type ConnectError } from '@connectrpc/connect';
import { describe, expect, it, vi } from 'vitest';
import { createLoginHandler } from '@/features/authentication/adapters/connect/auth-service.routes';
import { InvalidCredentialsError } from '@/features/authentication/domain/errors';

describe('[createLoginHandler]', () => {
  it('should map a successful login to the public response', async () => {
    const execute = vi.fn(async () => ({
      token: 'signed-token',
      user: { id: 'admin', email: 'admin@example.com', name: 'Admin' },
    }));

    await expect(
      createLoginHandler({ execute })({
        $typeName: 'auth.v1.LoginRequest',
        email: 'admin@example.com',
        password: 'valid-password',
      }),
    ).resolves.toMatchObject({
      token: 'signed-token',
      user: { email: 'admin@example.com' },
    });
  });

  it('should reject malformed input before invoking the use case', async () => {
    const execute = vi.fn();

    await expect(
      createLoginHandler({ execute })({
        $typeName: 'auth.v1.LoginRequest',
        email: 'invalid',
        password: '',
      }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument });
    expect(execute).not.toHaveBeenCalled();
  });

  it('should map invalid credentials to unauthenticated', async () => {
    const execute = vi.fn(async () => {
      throw new InvalidCredentialsError();
    });

    await expect(
      createLoginHandler({ execute })({
        $typeName: 'auth.v1.LoginRequest',
        email: 'admin@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ConnectError>>({
        code: Code.Unauthenticated,
      }),
    );
  });
});
