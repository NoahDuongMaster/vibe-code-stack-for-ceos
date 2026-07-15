import { DurableObject } from 'cloudflare:workers';
import { ConsumeRateLimitTokenUseCase } from '@/features/rate-limiting/application/consume-rate-limit-token/consume-rate-limit-token.use-case';
import type { RateLimitPolicyPrimitives } from '@/features/rate-limiting/domain/rate-limit-policy';
import type { RateLimitDecision } from '@/features/rate-limiting/domain/token-bucket';
import { DurableObjectTokenBucketRepository } from '@/features/rate-limiting/infra/cloudflare/durable-object-token-bucket.repository';

/** Cloudflare RPC adapter wrapping the token-bucket application service. */
export class RateLimiterDO extends DurableObject {
  async limit(policy: RateLimitPolicyPrimitives): Promise<RateLimitDecision> {
    const repository = new DurableObjectTokenBucketRepository(this.ctx.storage);
    const consumeToken = new ConsumeRateLimitTokenUseCase(repository);
    return consumeToken.execute({ policy, now: Date.now() });
  }
}
