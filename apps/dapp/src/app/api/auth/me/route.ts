import { NextResponse } from 'next/server';
import { getSession } from '@/server/lib/session';

export const GET = async () => {
  const session = await getSession();

  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ isLoggedIn: false });
  }

  // Never leak the access token to the client — expose the public profile only.
  const { id, email, name, avatarUrl } = session.user;
  return NextResponse.json({
    isLoggedIn: true,
    user: { id, email, name, avatarUrl },
  });
};
