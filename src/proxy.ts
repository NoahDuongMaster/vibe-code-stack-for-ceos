import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PROTECTED_ROUTES = ['/dashboard', '/profile', '/settings'];
const SIGN_IN_PATH = '/sign-in';

// Rate limiting is handled at the infrastructure layer (Cloudflare WAF / rate limiting rules).
// In-memory Maps don't survive across stateless edge isolates.

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('..') || decoded.includes('%2e%2e')) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'PATH_TRAVERSAL' },
      { status: 403 },
    );
  }

  if (isProtectedRoute(pathname)) {
    const session = request.cookies.get('app-session');
    if (!session?.value) {
      const signInUrl = new URL(SIGN_IN_PATH, request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== 'production';

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(!isDev ? ['upgrade-insecure-requests'] : []),
  ];

  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

  response.headers.set('x-nonce', nonce);
  response.headers.set(
    isDev ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    cspDirectives.join('; '),
  );

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
