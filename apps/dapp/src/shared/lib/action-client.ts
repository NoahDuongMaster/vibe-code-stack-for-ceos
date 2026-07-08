import { createSafeActionClient } from 'next-safe-action';
import { logger } from '@/shared/utils/logger.helper';

/**
 * Throw this from a server action when the message is safe to show the user
 * verbatim (e.g. "Session already expired"). Any other thrown error is
 * logged server-side but never echoed to the client — internal error
 * messages (DB errors, stack traces, etc.) must not leak to the browser.
 */
export class ActionError extends Error {}

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    logger.error('[action]', e.message, e.stack);
    if (e instanceof ActionError) return e.message;
    return 'Something went wrong. Please try again.';
  },
});
