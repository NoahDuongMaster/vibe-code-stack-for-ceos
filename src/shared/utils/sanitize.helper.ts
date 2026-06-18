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
