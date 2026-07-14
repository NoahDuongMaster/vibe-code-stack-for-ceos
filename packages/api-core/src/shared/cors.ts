export const CORS_ALLOWED_HEADERS =
  'Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms, X-Grpc-Web, X-User-Agent';
export const CORS_ALLOWED_METHODS = 'GET, POST, OPTIONS';

/**
 * Whether an origin passes the allow-list ('*' = any). Narrows `origin` to a
 * string so callers can use it directly. Shared so the fetch runtime and the
 * Node http server make the identical decision instead of drifting.
 */
export function isOriginAllowed(
  origin: string | null | undefined,
  allowedOrigins: string[] | undefined,
): origin is string {
  if (!origin || !allowedOrigins?.length) return false;
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

/**
 * CORS headers to attach for an allow-listed Origin, or null when it isn't
 * allowed (or CORS isn't configured). Exported so a proxying gateway can
 * re-stamp a proxied response with the exact same decision it made — keeping the
 * gateway the single CORS authority rather than trusting the upstream.
 */
export function resolveCorsHeaders(
  origin: string | null,
  allowedOrigins: string[] | undefined,
): Headers | null {
  if (!isOriginAllowed(origin, allowedOrigins)) return null;

  return new Headers({
    'Access-Control-Allow-Origin': allowedOrigins?.includes('*') ? '*' : origin,
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
}
