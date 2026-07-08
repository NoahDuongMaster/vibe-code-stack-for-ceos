import { type ConnectRouter, createConnectRouter } from '@connectrpc/connect';
// `@connectrpc/connect/protocol` is a documented public subpath (declared in
// the package's `exports` map) intended for building custom fetch/runtime
// adapters — not a private internal import. It follows the package's semver
// like any other export.
import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from '@connectrpc/connect/protocol';
import { ApiService } from '@repo/protocol';

export interface ApiConfig {
  serviceName: string;
  runtime: string;
  /** Allowed CORS origins for browser clients (e.g. the admin SPA). '*' allows any origin. */
  corsOrigins?: string[];
}

const CORS_ALLOWED_HEADERS =
  'Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms, X-Grpc-Web, X-User-Agent';
const CORS_ALLOWED_METHODS = 'GET, POST, OPTIONS';

/**
 * Computes the CORS headers to attach for a given request Origin + allow-list,
 * or null if the origin isn't allowed (or CORS isn't configured). Exported so
 * a proxying gateway (services/api-gateway) can annotate a proxied upstream
 * response with the exact same CORS decision it made for the preflight —
 * keeping the gateway the single CORS authority instead of trusting whatever
 * the upstream service decided.
 */
export function resolveCorsHeaders(
  origin: string | null,
  allowedOrigins: string[] | undefined,
): Headers | null {
  if (!origin || !allowedOrigins?.length) return null;
  const isAllowed =
    allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  if (!isAllowed) return null;

  return new Headers({
    'Access-Control-Allow-Origin': allowedOrigins.includes('*') ? '*' : origin,
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}

/**
 * Runtime-agnostic Connect service implementation (ApiService: Echo + Health).
 * The exact same routes run on Cloudflare Workers and Node — each service only
 * supplies config + the runtime adapter.
 */
export function createRoutes(config: ApiConfig) {
  return (router: ConnectRouter) => {
    router.service(ApiService, {
      echo: (req) => ({
        message: req.message,
        upper: req.message.toUpperCase(),
        length: req.message.length,
        runtime: config.runtime,
      }),
      health: () => ({
        status: 'ok',
        service: config.serviceName,
        runtime: config.runtime,
      }),
    });
  };
}

/**
 * A `fetch`-style handler that serves the Connect routes on ANY fetch runtime
 * (Cloudflare Workers natively, Bun, Deno, or a Node fetch server).
 * Connect ships no official fetch adapter, so we dispatch to the universal
 * handlers built by `createConnectRouter`.
 *
 * Handles CORS preflight (OPTIONS) and annotates every response with
 * Access-Control-* headers when the request's Origin is allow-listed.
 * `corsOrigins` on the returned handler's second argument overrides
 * `config.corsOrigins` — used by runtimes (e.g. Cloudflare Workers) where the
 * allow-list only becomes available per-request via an env binding.
 */
export function createFetchHandler(config: ApiConfig) {
  const router = createConnectRouter();
  createRoutes(config)(router);
  const handlers = new Map(router.handlers.map((h) => [h.requestPath, h]));

  return async (
    request: Request,
    corsOrigins?: string[],
  ): Promise<Response> => {
    const allowedOrigins = corsOrigins ?? config.corsOrigins;
    const cors = resolveCorsHeaders(
      request.headers.get('origin'),
      allowedOrigins,
    );

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors ?? undefined });
    }

    const { pathname } = new URL(request.url);
    const handler = handlers.get(pathname);
    if (!handler?.allowedMethods.includes(request.method)) {
      return new Response('Not Found', {
        status: 404,
        headers: cors ?? undefined,
      });
    }
    const res = await handler(universalServerRequestFromFetch(request, {}));
    const fetchRes = universalServerResponseToFetch(res);
    if (cors) {
      for (const [key, value] of cors.entries())
        fetchRes.headers.set(key, value);
    }
    return fetchRes;
  };
}
