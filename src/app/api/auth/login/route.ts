import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/lib/session';

const ZLoginBody = z.object({
  accessToken: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  }),
});

// WARNING: This route trusts the client-supplied accessToken without server-side
// verification. Before production use, validate the token against your auth backend.
// TODO: replace with actual OAuth callback that verifies tokens server-side.
export const POST = async (req: NextRequest) => {
  const parsed = ZLoginBody.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { accessToken, user } = parsed.data;

  const session = await getSession();
  session.isLoggedIn = true;
  session.user = { ...user, accessToken };
  await session.save();

  return NextResponse.json({ success: true });
};
