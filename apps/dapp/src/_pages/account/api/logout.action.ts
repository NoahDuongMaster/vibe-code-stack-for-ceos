'use server';

import { getMutableSession } from '@/entities/session/index.server';
import { actionClient } from '@/shared/api/index.server';

/**
 * Server action (next-safe-action) that clears the session cookie server-side.
 * Preferred over a REST route for mutations — end-to-end typed, no manual fetch.
 */
export const logoutAction = actionClient.action(async () => {
  const session = await getMutableSession();
  session.destroy();
  return { success: true };
});
