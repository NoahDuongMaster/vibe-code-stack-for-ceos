import { NextResponse } from 'next/server';
import { getPublicSession } from '@/entities/session/index.server';

export const getCurrentSession = async () => {
  const session = await getPublicSession();
  return NextResponse.json(session);
};
