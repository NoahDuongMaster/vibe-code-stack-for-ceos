'use server';

import { getSession } from '@/server/lib/session';
import { actionClient } from '@/shared/lib/action-client';

/**
 * Server action (next-safe-action) that clears the session cookie server-side.
 * Preferred over a REST route for mutations — end-to-end typed, no manual fetch.
 */
export const logoutAction = actionClient.action(async () => {
  const session = await getSession();
  session.destroy();
  return { success: true };
});
