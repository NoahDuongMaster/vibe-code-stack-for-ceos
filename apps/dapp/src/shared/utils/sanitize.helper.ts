const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return '#';
    }
    return parsed.href;
  } catch {
    return '#';
  }
}

/**
 * True if `path` is a same-origin relative path safe to redirect to after
 * login. Rejects protocol-relative URLs (`//evil.com` — browsers resolve a
 * leading `//` against the current protocol, sending the user off-site) and
 * the backslash variant (`/\evil.com`, which some browsers also normalize
 * to protocol-relative).
 */
export function isSafeRedirectPath(path: string): boolean {
  return (
    path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
  );
}

export function isValidOrigin(origin: string, allowList: string[]): boolean {
  try {
    const { hostname } = new URL(origin);
    return allowList.some((allowed) => {
      try {
        return new URL(allowed).hostname === hostname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
