import type { NextRequest } from 'next/server';
import { handleProxy } from '@/_app/proxy';

export function proxy(request: NextRequest) {
  return handleProxy(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
