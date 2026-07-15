import type { RateLimitPolicyPrimitives } from '@/features/rate-limiting/domain/rate-limit-policy';
import type { RateLimitDecision } from '@/features/rate-limiting/domain/token-bucket';

export interface ConsumeRateLimitTokenCommand {
  policy: RateLimitPolicyPrimitives;
  now: number;
}

/** Driving port used by the Durable Object RPC adapter. */
export interface ConsumeRateLimitToken {
  execute(command: ConsumeRateLimitTokenCommand): Promise<RateLimitDecision>;
}
