import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRateLimited } from '@/shared/lib/rate-limit';

describe('rate-limit', () => {
  it('should allow requests under the limit', () => {
    const key = `under-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) {
      expect(isRateLimited(key, { limit: 5, windowMs: 60_000 })).toBe(false);
    }
  });

  it('should block requests once the limit is exceeded', () => {
    const key = `over-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      isRateLimited(key, { limit: 3, windowMs: 60_000 });
    }
    expect(isRateLimited(key, { limit: 3, windowMs: 60_000 })).toBe(true);
  });

  it('should track distinct keys independently', () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    isRateLimited(keyA, { limit: 1, windowMs: 60_000 });
    expect(isRateLimited(keyA, { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(isRateLimited(keyB, { limit: 1, windowMs: 60_000 })).toBe(false);
  });

  describe('window expiry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reset the count once the window elapses', () => {
      const key = `expiry-${Math.random()}`;
      isRateLimited(key, { limit: 1, windowMs: 1_000 });
      expect(isRateLimited(key, { limit: 1, windowMs: 1_000 })).toBe(true);

      vi.advanceTimersByTime(1_001);

      expect(isRateLimited(key, { limit: 1, windowMs: 1_000 })).toBe(false);
    });
  });
});
