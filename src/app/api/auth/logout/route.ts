import { NextResponse } from 'next/server';
import { getSession } from '@/server/lib/session';

export const POST = async () => {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ success: true });
};
