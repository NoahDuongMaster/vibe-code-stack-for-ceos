import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/server/lib/session';

// TODO: replace this with your actual auth backend (Cloudflare Workers, etc.)
// This route handles the callback after OAuth or credential verification
export const POST = async (req: NextRequest) => {
  const body = await req.json();
  const { accessToken, user } = body;

  if (!accessToken || !user) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const session = await getSession();
  session.isLoggedIn = true;
  session.user = { ...user, accessToken };
  await session.save();

  return NextResponse.json({ success: true });
};
