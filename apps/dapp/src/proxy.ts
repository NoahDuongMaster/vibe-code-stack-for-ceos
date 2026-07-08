import { unsealData } from 'iron-session';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env } from '@/shared/config/env.configuration';
import { WEB_ROUTES } from '@/shared/constants/routes.constant';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/shared/constants/session.constant';
import type { TServerSessionData } from '@/shared/schemas/session.schema';

// `/account` is the only route in this boilerplate that actually renders
// auth-gated content today — extend this list as real protected pages are added.
const PROTECTED_ROUTES = [WEB_ROUTES.ACCOUNT];

// Rate limiting is handled at the infrastructure layer (Cloudflare WAF / rate limiting rules).
// In-memory Maps don't survive across stateless edge isolates.

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

// Verifies the sealed iron-session cookie rather than just checking for its
// presence — an empty/forged/expired cookie must not grant access.
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return false;
  try {
    const data = await unsealData<TServerSessionData>(cookie, {
      password: env.server.SESSION_SECRET,
      ttl: SESSION_MAX_AGE_SECONDS,
    });
    return !!data.isLoggedIn;
  } catch {
    return false;
  }
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

export default async function proxy(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('..') || decoded.includes('%2e%2e')) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'PATH_TRAVERSAL' },
      { status: 403 },
    );
  }

  if (isProtectedRoute(pathname) && !(await hasValidSession(request))) {
    const signInUrl = new URL(WEB_ROUTES.SIGN_IN, request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
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

  const cspHeaderName = isDev
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  const cspHeaderValue = cspDirectives.join('; ');

  // Both headers must be set on the outgoing REQUEST (not just the response) —
  // Next.js reads the CSP off the request during rendering to auto-stamp this
  // nonce onto its own inline scripts (RSC streaming payloads, framework
  // runtime). Setting them only on response.headers leaves those scripts
  // nonce-less under a strict CSP with no 'unsafe-inline' fallback.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(cspHeaderName, cspHeaderValue);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('x-nonce', nonce);
  response.headers.set(cspHeaderName, cspHeaderValue);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
