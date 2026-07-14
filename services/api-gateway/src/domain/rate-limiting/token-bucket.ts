import { InvalidTokenBucketStateError } from '@/domain/rate-limiting/errors';
import {
  RateLimitPolicy,
  type RateLimitPolicyPrimitives,
} from '@/domain/rate-limiting/rate-limit-policy';

export interface RateLimitDecision {
  success: boolean;
  remaining: number;
}

export interface TokenBucketSnapshot {
  tokens: number;
  updatedAt: number;
}

/**
 * Aggregate root owning token-bucket invariants and state transitions.
 * Persistence and Cloudflare lifecycle concerns remain outside the domain.
 */
export class TokenBucket {
  private constructor(
    private tokens: number,
    private updatedAt: number,
  ) {}

  static initialize(policy: RateLimitPolicy, now: number): TokenBucket {
    TokenBucket.assertTimestamp(now);
    return new TokenBucket(policy.limit, now);
  }

  static rehydrate(
    snapshot: TokenBucketSnapshot,
    policy: RateLimitPolicy,
  ): TokenBucket {
    if (
      !Number.isFinite(snapshot.tokens) ||
      snapshot.tokens < 0 ||
      !Number.isFinite(snapshot.updatedAt) ||
      snapshot.updatedAt < 0
    ) {
      throw new InvalidTokenBucketStateError();
    }

    return new TokenBucket(
      Math.min(snapshot.tokens, policy.limit),
      snapshot.updatedAt,
    );
  }

  consume(policy: RateLimitPolicy, now: number): RateLimitDecision {
    TokenBucket.assertTimestamp(now);
    const elapsed = Math.max(0, now - this.updatedAt);
    const refillPerMs = policy.limit / policy.periodMs;
    this.tokens = Math.min(policy.limit, this.tokens + elapsed * refillPerMs);
    this.updatedAt = now;

    if (this.tokens < 1) {
      return { success: false, remaining: 0 };
    }

    this.tokens -= 1;
    return { success: true, remaining: Math.floor(this.tokens) };
  }

  toSnapshot(): TokenBucketSnapshot {
    return { tokens: this.tokens, updatedAt: this.updatedAt };
  }

  private static assertTimestamp(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new InvalidTokenBucketStateError();
    }
  }
}

/** Compatibility helper for pure callers; delegates to the aggregate root. */
export const refillAndConsume = (
  snapshot: TokenBucketSnapshot,
  policyInput: RateLimitPolicyPrimitives,
  now: number,
): { bucket: TokenBucketSnapshot; result: RateLimitDecision } => {
  const policy = RateLimitPolicy.create(policyInput);
  const bucket = TokenBucket.rehydrate(snapshot, policy);
  const result = bucket.consume(policy, now);
  return { bucket: bucket.toSnapshot(), result };
};
