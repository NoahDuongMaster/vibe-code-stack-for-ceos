import type { RateLimiterDO } from '@/features/rate-limiting/adapters/cloudflare/rate-limiter.do';
import type { RateLimiter } from '@/features/rate-limiting/application/enforce-rate-limit/rate-limiter.port';
import type { ClientIdentifier } from '@/features/rate-limiting/domain/client-identifier';
import type { RateLimitPolicy } from '@/features/rate-limiting/domain/rate-limit-policy';
import type { RateLimitDecision } from '@/features/rate-limiting/domain/token-bucket';

const DISABLED_DECISION: RateLimitDecision = {
  success: true,
  remaining: Number.MAX_SAFE_INTEGER,
};

/**
 * Cloudflare Durable Object adapter. An absent namespace intentionally disables
 * rate limiting for local/unconfigured environments while preserving the port.
 */
export const createDurableObjectRateLimiterAdapter = (
  namespace: DurableObjectNamespace<RateLimiterDO> | undefined,
): RateLimiter => ({
  async consume(
    client: ClientIdentifier,
    policy: RateLimitPolicy,
  ): Promise<RateLimitDecision> {
    if (!namespace) return DISABLED_DECISION;

    const limiter = namespace.get(namespace.idFromName(client.value));
    return limiter.limit(policy.toPrimitives());
  },
});
