/**
 * Best-effort, per-instance rate limiter. This only protects the Node/Docker
 * deploy target (a single long-lived process) — on Cloudflare Workers each
 * request can land on a different, stateless isolate, so an in-memory Map
 * here does NOT reliably throttle abuse on that deploy target (see the same
 * caveat documented in `proxy.ts`). Configure rate limiting at the
 * Cloudflare WAF / rules layer for the Workers deployment; treat this as
 * defense-in-depth for the Node runtime only.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

const MAX_TRACKED_KEYS = 10_000;

export function isRateLimited(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
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
}
