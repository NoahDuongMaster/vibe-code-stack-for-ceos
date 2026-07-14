import type { RateLimiter } from '@/application/enforce-rate-limit/rate-limiter.port';
import type { ClientIdentifier } from '@/domain/rate-limiting/client-identifier';
import type { RateLimitPolicy } from '@/domain/rate-limiting/rate-limit-policy';
import type { RateLimitDecision } from '@/domain/rate-limiting/token-bucket';
import type { RateLimiterDO } from '@/infra/rate-limiting/rate-limiter.do';

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
