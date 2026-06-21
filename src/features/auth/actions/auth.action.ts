'use server';

import { z } from 'zod';
import { getSession } from '@/server/lib/session';
import { actionClient } from '@/shared/lib/action-client';

const ZLoginInput = z.object({
  accessToken: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  }),
});

export const loginAction = actionClient
  .schema(ZLoginInput)
  .action(async ({ parsedInput }) => {
    const session = await getSession();
    session.isLoggedIn = true;
    session.user = {
      ...parsedInput.user,
      accessToken: parsedInput.accessToken,
    };
    await session.save();
    return { success: true };
  });

export const logoutAction = actionClient.action(async () => {
  const session = await getSession();
  session.destroy();
  return { success: true };
});
