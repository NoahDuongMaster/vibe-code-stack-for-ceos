export abstract class RateLimitingDomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidRateLimitPolicyError extends RateLimitingDomainError {
  readonly code = 'invalid_rate_limit_policy';

  constructor() {
    super('Rate limit policy must use positive integer values');
  }
}

export class InvalidTokenBucketStateError extends RateLimitingDomainError {
  readonly code = 'invalid_token_bucket_state';

  constructor() {
    super('Token bucket state is invalid');
  }
}
