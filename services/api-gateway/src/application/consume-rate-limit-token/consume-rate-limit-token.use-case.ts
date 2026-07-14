import type { ConsumeRateLimitToken } from '@/application/consume-rate-limit-token/consume-rate-limit-token.port';
import { RateLimitPolicy } from '@/domain/rate-limiting/rate-limit-policy';
import {
  type RateLimitDecision,
  TokenBucket,
} from '@/domain/rate-limiting/token-bucket';
import type { TokenBucketRepository } from '@/domain/rate-limiting/token-bucket.repository.port';

/** Application service executing one atomic aggregate load-transition-save cycle. */
export class ConsumeRateLimitTokenUseCase implements ConsumeRateLimitToken {
  constructor(private readonly repository: TokenBucketRepository) {}

  async execute(command: {
    policy: { limit: number; periodMs: number };
    now: number;
  }): Promise<RateLimitDecision> {
    const policy = RateLimitPolicy.create(command.policy);
    const stored = await this.repository.find();
    const bucket = stored
      ? TokenBucket.rehydrate(stored, policy)
      : TokenBucket.initialize(policy, command.now);
    const decision = bucket.consume(policy, command.now);
    await this.repository.save(bucket.toSnapshot());
    return decision;
  }
}
