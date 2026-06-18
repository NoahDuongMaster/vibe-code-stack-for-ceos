import { NextResponse } from 'next/server';
import { getSession } from '@/server/lib/session';

export const GET = async () => {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ isLoggedIn: false });
  }
  return NextResponse.json({ isLoggedIn: true, user: session.user });
};
