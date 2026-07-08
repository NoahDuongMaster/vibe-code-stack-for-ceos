import * as http from 'node:http';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { createRoutes } from '@repo/api-core';
import { createRateLimiter } from './rate-limit';

const CORS_ALLOWED_HEADERS =
  'Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms, X-Grpc-Web, X-User-Agent';

export interface ServerOptions {
  /** Allowed CORS origins for browser clients. '*' allows any origin. Defaults to none. */
  corsOrigins?: string[];
  /** Rejects requests whose Content-Length exceeds this many bytes. Defaults to 5 MB. */
  maxBodyBytes?: number;
  /** Socket idle timeout in ms, passed through to `http.Server#timeout`. Defaults to 30s. */
  requestTimeoutMs?: number;
  /** Max requests per client per `rateLimitWindowMs`. Defaults to 300. See rate-limit.ts for why this is defense-in-depth only. */
  rateLimit?: number;
  /** Rate limit window in ms. Defaults to 60s. */
  rateLimitWindowMs?: number;
}

/** Best-effort client identity: trusts `x-forwarded-for` only because a real deployment sits behind api-gateway/a LB that sets it; falls back to the raw socket address. */
function getClientKey(req: http.IncomingMessage): string {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

/** Sets CORS headers when the request's Origin is allow-listed. Returns true if the request (an OPTIONS preflight) was fully handled. */
function applyCors(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  allowedOrigins: string[],
): boolean {
  const origin = req.headers.origin;
  if (
    origin &&
    (allowedOrigins.includes('*') || allowedOrigins.includes(origin))
  ) {
    res.setHeader(
      'Access-Control-Allow-Origin',
      allowedOrigins.includes('*') ? '*' : origin,
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

function logRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  startedAt: number,
) {
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.url,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  });
}

/**
 * Builds the api-node HTTP server: Connect RPC (Echo + Health), CORS,
 * a request body size cap, and a fast LB-friendly `/healthz`.
 * Pure factory — has no side effects and does not call `.listen()`.
 */
export function createServer(options: ServerOptions = {}): http.Server {
  const allowedOrigins = options.corsOrigins ?? [];
  const maxBodyBytes = options.maxBodyBytes ?? 5 * 1024 * 1024;
  const isRateLimited = createRateLimiter();

  const rpcHandler = connectNodeAdapter({
    routes: createRoutes({ serviceName: 'api-node', runtime: 'node' }),
    // Without this, Connect defaults to a ~4 GiB read limit — a request with
    // `Transfer-Encoding: chunked` (no Content-Length) would sail past the
    // Content-Length check below entirely. This is the real enforcement
    // point; the Content-Length check is just a fast-fail for the common case.
    readMaxBytes: maxBodyBytes,
    writeMaxBytes: maxBodyBytes,
  });

  const server = http.createServer((req, res) => {
    logRequest(req, res, performance.now());

    if (applyCors(req, res, allowedOrigins)) return;

    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (
      isRateLimited(getClientKey(req), {
        limit: options.rateLimit ?? 300,
        windowMs: options.rateLimitWindowMs ?? 60_000,
      })
    ) {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end('Too Many Requests');
      return;
    }

    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (contentLength > maxBodyBytes) {
      res.writeHead(413, { 'Content-Type': 'text/plain' });
      res.end('Payload Too Large');
      return;
    }

    rpcHandler(req, res);
  });

  // Guard against slow-loris style connections; both must exceed typical
  // upstream LB/proxy idle timeouts to avoid dropping healthy keep-alive conns.
  server.timeout = options.requestTimeoutMs ?? 30_000;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  return server;
}
