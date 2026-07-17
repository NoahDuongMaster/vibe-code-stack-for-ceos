import { type NextRequest, NextResponse } from 'next/server';
import { getMutableSession } from '@/entities/session/index.server';
import {
  verifyCredentials,
  ZLoginInput,
} from '@/features/sign-in/index.server';
import { logger } from '@/shared/lib/logger';
import { isRateLimited } from '@/shared/lib/rate-limit';

// Best-effort per-instance limiter — see shared/lib/rate-limit for why
// Cloudflare deployments also need infrastructure-level rate limiting.
const getClientKey = (request: NextRequest): string =>
  request.headers.get('cf-connecting-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown';

export const postLogin = async (request: NextRequest) => {
  const clientKey = getClientKey(request);
  if (isRateLimited(`login:${clientKey}`, { limit: 10, windowMs: 60_000 })) {
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
