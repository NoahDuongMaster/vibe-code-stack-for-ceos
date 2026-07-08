import { type NextRequest, NextResponse } from 'next/server';
import { ZLoginInput } from '@/features/auth';
import { verifyCredentials } from '@/server/lib/auth';
import { getSession } from '@/server/lib/session';
import { isRateLimited } from '@/shared/lib/rate-limit';
import { logger } from '@/shared/utils/logger.helper';

// Best-effort per-instance limiter — see shared/lib/rate-limit.ts for why
// this alone isn't sufficient on the Cloudflare Workers deploy target; that
// target needs WAF-level rate limiting rules in front of this route too.
const getClientKey = (req: NextRequest): string =>
  req.headers.get('cf-connecting-ip') ??
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown';

export const POST = async (req: NextRequest) => {
  const clientKey = getClientKey(req);
  if (isRateLimited(`login:${clientKey}`, { limit: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
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

  const session = await getSession();
  session.isLoggedIn = true;
  session.user = user;
  await session.save();

  return NextResponse.json({ success: true });
};
