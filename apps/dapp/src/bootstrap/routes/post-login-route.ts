import { type NextRequest, NextResponse } from 'next/server';
import { getMutableSession } from '@/entities/session/index.server';
import {
  verifyCredentials,
  ZLoginInput,
} from '@/features/sign-in/index.server';
import { logger } from '@/shared/lib/logger';
import {
  DistributedRateLimiterUnavailableError,
  isLoginRateLimited,
} from '@/shared/lib/rate-limit/index.server';

// Cloudflare provides the trusted edge IP; native development falls back to
// the proxy header while production authorization uses the distributed DO.
const getClientKey = (request: NextRequest): string =>
  request.headers.get('cf-connecting-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown';

export const postLogin = async (request: NextRequest) => {
  const clientKey = getClientKey(request);
  let rateLimited: boolean;
  try {
    rateLimited = await isLoginRateLimited(clientKey);
  } catch (error) {
    logger.error('[auth/login] distributed rate limiter unavailable', error);
    const status =
      error instanceof DistributedRateLimiterUnavailableError ? 503 : 500;
    return NextResponse.json(
      { error: 'Authentication is temporarily unavailable' },
      { status },
    );
  }

  if (rateLimited) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn('[auth/login] malformed JSON body', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const parsed = ZLoginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 },
    );
  }

  const session = await getMutableSession();
  session.isLoggedIn = true;
  session.user = user;
  await session.save();

  return NextResponse.json({ success: true });
};
