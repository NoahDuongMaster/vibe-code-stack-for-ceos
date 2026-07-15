import { describe, expect, it, vi } from 'vitest';
import { ConsumeRateLimitTokenUseCase } from '@/features/rate-limiting/application/consume-rate-limit-token/consume-rate-limit-token.use-case';

describe('[ConsumeRateLimitTokenUseCase]', () => {
  it('should initialize, consume, and persist a new aggregate', async () => {
    const save = vi.fn(async () => undefined);
    const useCase = new ConsumeRateLimitTokenUseCase({
      find: vi.fn(async () => undefined),
      save,
    });

    await expect(
      useCase.execute({
        policy: { limit: 3, periodMs: 3000 },
        now: 1000,
      }),
    ).resolves.toEqual({ success: true, remaining: 2 });
    expect(save).toHaveBeenCalledWith({ tokens: 2, updatedAt: 1000 });
  });

  it('should rehydrate an existing aggregate before applying a transition', async () => {
    const save = vi.fn(async () => undefined);
    const useCase = new ConsumeRateLimitTokenUseCase({
      find: vi.fn(async () => ({ tokens: 0, updatedAt: 1000 })),
      save,
    });

    await expect(
      useCase.execute({
        policy: { limit: 3, periodMs: 3000 },
        now: 2000,
      }),
    ).resolves.toEqual({ success: true, remaining: 0 });
    expect(save).toHaveBeenCalledWith({ tokens: 0, updatedAt: 2000 });
  });
});
