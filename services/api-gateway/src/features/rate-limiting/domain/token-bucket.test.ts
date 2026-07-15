import { describe, expect, it } from 'vitest';
import { RateLimitPolicy } from '@/features/rate-limiting/domain/rate-limit-policy';
import { TokenBucket } from '@/features/rate-limiting/domain/token-bucket';

describe('[TokenBucket]', () => {
  const policy = RateLimitPolicy.create({ limit: 3, periodMs: 3000 });

  it('should reject a rate-limit policy that cannot preserve bucket invariants', () => {
    expect(() => RateLimitPolicy.create({ limit: 0, periodMs: 3000 })).toThrow(
      'Rate limit policy',
    );
  });

  it('should allow a burst up to capacity then deny without elapsed time', () => {
    const bucket = TokenBucket.initialize(policy, 1000);

    for (let index = 0; index < policy.limit; index += 1) {
      expect(bucket.consume(policy, 1000).success).toBe(true);
    }

    expect(bucket.consume(policy, 1000).success).toBe(false);
  });

  it('should refill continuously without exceeding capacity', () => {
    const halfRefilled = TokenBucket.rehydrate(
      { tokens: 0, updatedAt: 1000 },
      policy,
    );
    expect(halfRefilled.consume(policy, 1500).success).toBe(false);

    const refilled = TokenBucket.rehydrate(
      { tokens: 0, updatedAt: 1000 },
      policy,
    );
    expect(refilled.consume(policy, 2000).success).toBe(true);

    const full = TokenBucket.initialize(policy, 1000);
    full.consume(policy, 10_000_000);
    expect(full.toSnapshot().tokens).toBeCloseTo(policy.limit - 1);
  });

  it('should expose only whole remaining tokens', () => {
    const bucket = TokenBucket.initialize(policy, 1000);
    expect(bucket.consume(policy, 1000).remaining).toBe(2);
  });
});
