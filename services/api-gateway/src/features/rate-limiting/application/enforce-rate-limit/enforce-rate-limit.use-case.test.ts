import { describe, expect, it, vi } from 'vitest';
import { EnforceRateLimitUseCase } from '@/features/rate-limiting/application/enforce-rate-limit/enforce-rate-limit.use-case';
import { RateLimitPolicy } from '@/features/rate-limiting/domain/rate-limit-policy';
import { GatewayAccessPolicy } from '@/shared/access-policy';

describe('[EnforceRateLimitUseCase]', () => {
  const accessPolicy = new GatewayAccessPolicy(['/healthz']);
  const policy = RateLimitPolicy.create({ limit: 3, periodMs: 3000 });

  it('should bypass the limiter for public paths', async () => {
    const consume = vi.fn(async () => ({ success: false, remaining: 0 }));
    const useCase = new EnforceRateLimitUseCase(
      accessPolicy,
      { consume },
      policy,
      { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
    );

    await expect(
      useCase.execute({
        pathname: '/healthz',
        clientIdentifier: undefined,
        requestId: 'request-1',
      }),
    ).resolves.toEqual({ allowed: true });
    expect(consume).not.toHaveBeenCalled();
  });

  it('should preserve a limiter denial', async () => {
    const consume = vi.fn(async () => ({ success: false, remaining: 0 }));
    const useCase = new EnforceRateLimitUseCase(
      accessPolicy,
      { consume },
      policy,
      { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
    );

    await expect(
      useCase.execute({
        pathname: '/private',
        clientIdentifier: '203.0.113.7',
        requestId: 'request-1',
      }),
    ).resolves.toEqual({ allowed: false });
    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'global:203.0.113.7' }),
      policy,
    );
  });

  it('should fail open and emit metadata when the limiter is unavailable', async () => {
    const warning = vi.fn();
    const useCase = new EnforceRateLimitUseCase(
      accessPolicy,
      {
        consume: vi.fn(async () => {
          throw new Error('unavailable');
        }),
      },
      policy,
      { error: vi.fn(), info: vi.fn(), warning },
    );

    await expect(
      useCase.execute({
        pathname: '/private',
        clientIdentifier: undefined,
        requestId: 'request-1',
      }),
    ).resolves.toEqual({ allowed: true });
    expect(warning).toHaveBeenCalledWith({
      event: 'rate_limiter_unavailable',
      errorName: 'Error',
      requestId: 'request-1',
    });
  });

  it('should apply a scoped override and fail closed when an auth limiter is unavailable', async () => {
    const loginPolicy = RateLimitPolicy.create({ limit: 10, periodMs: 60_000 });
    const warning = vi.fn();
    const consume = vi.fn(async () => {
      throw new Error('unavailable');
    });
    const useCase = new EnforceRateLimitUseCase(
      accessPolicy,
      { consume },
      policy,
      { error: vi.fn(), info: vi.fn(), warning },
      [
        {
          failClosed: true,
          identifierScope: 'admin-login',
          pathname: '/auth.v1.AuthService/Login',
          policy: loginPolicy,
        },
      ],
    );

    await expect(
      useCase.execute({
        pathname: '/auth.v1.AuthService/Login',
        clientIdentifier: '203.0.113.9',
        requestId: 'request-login',
      }),
    ).resolves.toEqual({ allowed: false });

    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'admin-login:203.0.113.9' }),
      loginPolicy,
    );
  });
});
