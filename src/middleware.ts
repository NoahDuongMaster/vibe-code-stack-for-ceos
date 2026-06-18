import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// OWASP A01:2021 — Broken Access Control | CWE-22 Path Traversal
// Reject any request containing directory traversal sequences before they
// reach route handlers. Double-decode catches %252e%252e (double-encoded).
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('..') || decoded.includes('%2e%2e')) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'PATH_TRAVERSAL' },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
