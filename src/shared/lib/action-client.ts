import { createSafeActionClient } from 'next-safe-action';
import { logger } from '@/shared/utils/logger.helper';

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    logger.error('[action]', e.message);
    return e.message;
  },
});
