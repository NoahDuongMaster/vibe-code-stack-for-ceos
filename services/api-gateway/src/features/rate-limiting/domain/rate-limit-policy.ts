import { InvalidRateLimitPolicyError } from '@/features/rate-limiting/domain/errors';

export interface RateLimitPolicyPrimitives {
  limit: number;
  periodMs: number;
}

/** Immutable value object defining a token bucket's capacity and refill window. */
export class RateLimitPolicy {
  private constructor(
    readonly limit: number,
    readonly periodMs: number,
  ) {}

  static create(input: RateLimitPolicyPrimitives): RateLimitPolicy {
    if (
      !Number.isInteger(input.limit) ||
      input.limit <= 0 ||
      !Number.isInteger(input.periodMs) ||
      input.periodMs <= 0
    ) {
      throw new InvalidRateLimitPolicyError();
    }

    return new RateLimitPolicy(input.limit, input.periodMs);
  }

  toPrimitives(): RateLimitPolicyPrimitives {
    return { limit: this.limit, periodMs: this.periodMs };
  }
}
