import type { RateLimitPolicyPrimitives } from '@/domain/rate-limiting/rate-limit-policy';
import type { RateLimitDecision } from '@/domain/rate-limiting/token-bucket';

export interface ConsumeRateLimitTokenCommand {
  policy: RateLimitPolicyPrimitives;
  now: number;
}

/** Driving port used by the Durable Object RPC adapter. */
export interface ConsumeRateLimitToken {
  execute(command: ConsumeRateLimitTokenCommand): Promise<RateLimitDecision>;
}
