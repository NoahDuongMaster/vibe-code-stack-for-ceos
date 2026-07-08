/**
 * Best-effort, per-instance rate limiter — defense-in-depth only. api-node is
 * normally reached through services/api-gateway (which has a real Cloudflare
 * Rate Limiting binding, see wrangler.jsonc) or should sit behind a load
 * balancer/WAF with its own rate limiting. If api-node is ever exposed
 * directly (e.g. a docker-compose port mapping with no gateway in front),
 * this in-memory limiter is the only thing between it and an unthrottled
 * client — and it only throttles per-process, so it does not coordinate
 * across multiple api-node replicas.
 *
 * A factory (not a module-level singleton) so each `createServer()` call
 * gets its own bucket store — keeps `createServer` a pure factory with no
 * shared global state, and keeps concurrent test servers isolated.
 */
const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter() {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return function isRateLimited(
    key: string,
    {
      limit = 300,
      windowMs = 60_000,
    }: { limit?: number; windowMs?: number } = {},
  ): boolean {
    const now = Date.now();

    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [trackedKey, bucket] of buckets) {
        if (now > bucket.resetAt) buckets.delete(trackedKey);
      }
    }

    const bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }

    bucket.count += 1;
    return bucket.count > limit;
  };
}
