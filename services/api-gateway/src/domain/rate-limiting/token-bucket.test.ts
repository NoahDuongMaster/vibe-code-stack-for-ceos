import { describe, expect, it } from 'vitest';
import { refillAndConsume } from '@/domain/rate-limiting/token-bucket';

describe('[TokenBucket]', () => {
  const policy = { limit: 3, periodMs: 3000 };

  it('should reject a rate-limit policy that cannot preserve bucket invariants', () => {
    expect(() =>
      refillAndConsume(
        { tokens: 0, updatedAt: 1000 },
        { limit: 0, periodMs: 3000 },
        1000,
      ),
    ).toThrow('Rate limit policy');
  });

  it('should allow a burst up to capacity then deny without elapsed time', () => {
    let bucket = { tokens: policy.limit, updatedAt: 1000 };

    for (let index = 0; index < policy.limit; index += 1) {
      const step = refillAndConsume(bucket, policy, 1000);
      expect(step.result.success).toBe(true);
      bucket = step.bucket;
    }

    expect(refillAndConsume(bucket, policy, 1000).result.success).toBe(false);
  });

  it('should refill continuously without exceeding capacity', () => {
    const drained = { tokens: 0, updatedAt: 1000 };
    expect(refillAndConsume(drained, policy, 1500).result.success).toBe(false);
    expect(refillAndConsume(drained, policy, 2000).result.success).toBe(true);

    const full = { tokens: policy.limit, updatedAt: 1000 };
    const { bucket } = refillAndConsume(full, policy, 10_000_000);
    expect(bucket.tokens).toBeCloseTo(policy.limit - 1);
  });

  it('should expose only whole remaining tokens', () => {
    const bucket = { tokens: 3, updatedAt: 1000 };
    expect(refillAndConsume(bucket, policy, 1000).result.remaining).toBe(2);
  });
});
