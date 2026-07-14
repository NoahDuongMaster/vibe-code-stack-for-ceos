import { DurableObject } from 'cloudflare:workers';
import { ConsumeRateLimitTokenUseCase } from '@/application/consume-rate-limit-token/consume-rate-limit-token.use-case';
import type { RateLimitPolicyPrimitives } from '@/domain/rate-limiting/rate-limit-policy';
import type { RateLimitDecision } from '@/domain/rate-limiting/token-bucket';
import { DurableObjectTokenBucketRepository } from '@/infra/rate-limiting/durable-object-token-bucket.repository';

/** Cloudflare RPC adapter wrapping the token-bucket application service. */
export class RateLimiterDO extends DurableObject {
  async limit(policy: RateLimitPolicyPrimitives): Promise<RateLimitDecision> {
    const repository = new DurableObjectTokenBucketRepository(this.ctx.storage);
    const consumeToken = new ConsumeRateLimitTokenUseCase(repository);
    return consumeToken.execute({ policy, now: Date.now() });
  }
}
