import { describe, expect, it, vi } from 'vitest';
import { AuthorizeGatewayRequestUseCase } from '@/application/authorize-gateway-request/authorize-gateway-request.use-case';
import { GatewayAccessPolicy } from '@/domain/access-control/gateway-access-policy';

describe('[AuthorizeGatewayRequestUseCase]', () => {
  const accessPolicy = new GatewayAccessPolicy(['/healthz']);

  it('should bypass verification when authentication is disabled', async () => {
    const verify = vi.fn(async () => false);
    const useCase = new AuthorizeGatewayRequestUseCase(
      accessPolicy,
      { verify },
      undefined,
    );

    await expect(
      useCase.execute({ pathname: '/private', authorizationHeader: undefined }),
    ).resolves.toEqual({ allowed: true });
    expect(verify).not.toHaveBeenCalled();
  });

  it('should keep public paths accessible when authentication is enabled', async () => {
    const verify = vi.fn(async () => false);
    const useCase = new AuthorizeGatewayRequestUseCase(
      accessPolicy,
      { verify },
      'secret',
    );

    await expect(
      useCase.execute({ pathname: '/healthz', authorizationHeader: undefined }),
    ).resolves.toEqual({ allowed: true });
    expect(verify).not.toHaveBeenCalled();
  });

  it('should reject a protected path without a valid bearer token', async () => {
    const verify = vi.fn(async () => false);
    const useCase = new AuthorizeGatewayRequestUseCase(
      accessPolicy,
      { verify },
      'secret',
    );

    await expect(
      useCase.execute({
        pathname: '/private',
        authorizationHeader: 'Bearer invalid',
      }),
    ).resolves.toEqual({ allowed: false });
    expect(verify).toHaveBeenCalledWith('invalid', 'secret');
  });
});
