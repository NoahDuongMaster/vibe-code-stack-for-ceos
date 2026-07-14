import type { ClientIdentifier } from '@/domain/rate-limiting/client-identifier';
import type { RateLimitPolicy } from '@/domain/rate-limiting/rate-limit-policy';
import type { RateLimitDecision } from '@/domain/rate-limiting/token-bucket';

/** Driven port implemented by the Cloudflare Durable Object adapter. */
export interface RateLimiter {
  consume(
    client: ClientIdentifier,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision>;
}
