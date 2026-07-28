import { describe, expect, it, vi } from 'vitest';
import { LoginUseCase } from '@/features/authentication/application/login.use-case';
import { InvalidCredentialsError } from '@/features/authentication/domain/errors';

const identity = { id: 'admin', email: 'admin@example.com', name: 'Admin' };

describe('[LoginUseCase]', () => {
  it('should issue a token for valid configured credentials', async () => {
    const credentialVerifier = { verify: vi.fn(async () => identity) };
    const accessTokenIssuer = { issue: vi.fn(async () => 'signed-token') };
    const useCase = new LoginUseCase(credentialVerifier, accessTokenIssuer);

    await expect(
      useCase.execute({ email: identity.email, password: 'valid-password' }),
    ).resolves.toEqual({ token: 'signed-token', user: identity });
    expect(accessTokenIssuer.issue).toHaveBeenCalledWith(identity);
  });

  it('should reject invalid credentials without issuing a token', async () => {
    const credentialVerifier = { verify: vi.fn(async () => null) };
    const accessTokenIssuer = { issue: vi.fn(async () => 'signed-token') };
    const useCase = new LoginUseCase(credentialVerifier, accessTokenIssuer);

    await expect(
      useCase.execute({ email: identity.email, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(accessTokenIssuer.issue).not.toHaveBeenCalled();
  });
});
