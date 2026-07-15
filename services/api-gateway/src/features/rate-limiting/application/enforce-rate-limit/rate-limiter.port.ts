import type { ClientIdentifier } from '@/features/rate-limiting/domain/client-identifier';
import type { RateLimitPolicy } from '@/features/rate-limiting/domain/rate-limit-policy';
import type { RateLimitDecision } from '@/features/rate-limiting/domain/token-bucket';

/** Driven port implemented by the Cloudflare Durable Object adapter. */
export interface RateLimiter {
  consume(
    client: ClientIdentifier,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision>;
}
