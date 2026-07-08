import { createFetchHandler, resolveCorsHeaders } from '@repo/api-core';

/**
 * TIER 1 — Cloudflare Workers (edge / lightweight services).
 * Global low-latency, scale-to-zero. Serves the light ApiService routes
 * (Echo, Health) locally for the lowest possible latency.
 *
 * This is a real gateway, not a pure duplicate: any request the edge tier
 * doesn't implement is forwarded to the Node upstream (TIER 2) when
 * `UPSTREAM_URL` is configured — so heavier routes can live in api-node only
 * while the gateway transparently proxies to them.
 */
interface Bindings {
  /** Base URL of the upstream Node service, e.g. "https://api-node.internal". Unmatched routes 404 when unset. */
  UPSTREAM_URL?: string;
  /** Comma-separated list of allowed CORS origins for browser clients (e.g. the admin SPA). */
  CORS_ORIGINS?: string;
  /** Cloudflare Rate Limiting binding (see wrangler.jsonc). Unbound in local dev — every check below no-ops when absent. */
  RATE_LIMITER?: RateLimit;
}

const handler = createFetchHandler({
  serviceName: 'gateway',
  runtime: 'cloudflare-workers',
});

const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Proxies to the upstream and re-stamps the response with the gateway's own
 * CORS decision (`cors`, computed from this Worker's `CORS_ORIGINS` — see
 * `fetch` below), overriding whatever the upstream itself sent. This keeps
 * the gateway the single CORS authority for browser clients: the preflight
 * (answered entirely locally, never proxied) and the real response always
 * agree, instead of depending on api-node's separately-configured allow-list
 * staying in sync with the gateway's.
 */
async function proxyToUpstream(
  request: Request,
  upstreamUrl: string,
  cors: Headers | null,
): Promise<Response> {
  const target = new URL(request.url);
  const upstream = new URL(upstreamUrl);
  target.protocol = upstream.protocol;
  target.host = upstream.host;

  try {
    const upstreamRes = await fetch(new Request(target, request), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!cors) return upstreamRes;

    const headers = new Headers(upstreamRes.headers);
    for (const [key, value] of cors.entries()) headers.set(key, value);
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    return new Response(isTimeout ? 'Upstream Timeout' : 'Bad Gateway', {
      status: isTimeout ? 504 : 502,
      headers: cors ?? undefined,
    });
  }
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    if (env.RATE_LIMITER) {
      // cf-connecting-ip is set by Cloudflare's edge and cannot be spoofed by
      // the client — safe to use as the rate-limit key without validation.
      const clientIp = request.headers.get('cf-connecting-ip') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return new Response('Too Many Requests', { status: 429 });
      }
    }

    const corsOrigins = env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const res = await handler(request, corsOrigins);
    if (res.status !== 404 || !env.UPSTREAM_URL) return res;

    const cors = resolveCorsHeaders(request.headers.get('origin'), corsOrigins);
    return proxyToUpstream(request, env.UPSTREAM_URL, cors);
  },
};
