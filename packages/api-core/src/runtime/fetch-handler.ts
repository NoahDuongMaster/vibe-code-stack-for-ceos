import { createConnectRouter } from '@connectrpc/connect';
// `@connectrpc/connect/protocol` is a documented public subpath (declared in
// the package's `exports` map) intended for building custom fetch/runtime
// adapters — not a private internal import. It follows the package's semver.
import {
  universalServerRequestFromFetch,
  universalServerResponseToFetch,
} from '@connectrpc/connect/protocol';
import type { ApiConfig } from '../shared/config';
import { resolveCorsHeaders } from '../shared/cors';
import { createRoutes } from './routes';

/**
 * A `fetch`-style handler that serves the Connect routes on ANY fetch runtime
 * (Cloudflare Workers natively, Bun, Deno, or a Node fetch server). Connect
 * ships no official fetch adapter, so we dispatch to the universal handlers
 * built by `createConnectRouter`.
 *
 * Handles CORS preflight (OPTIONS) and annotates every response with
 * Access-Control-* headers when the request's Origin is allow-listed. The
 * `corsOrigins` argument overrides `config.corsOrigins` — used by runtimes
 * (e.g. Cloudflare Workers) where the allow-list only becomes available
 * per-request via an env binding.
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
      for (const [key, value] of cors.entries()) {
        fetchRes.headers.set(key, value);
      }
    }
    return fetchRes;
  };
}
