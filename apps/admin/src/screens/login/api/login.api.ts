import { Code, ConnectError } from '@connectrpc/connect';
import { type TAuthSession, ZAuthSession } from '@/entities/session';
import { AuthError } from '@/screens/login/model/auth.error';
import type { TLoginInput } from '@/screens/login/model/login.schema';
import { authApiClient } from '@/shared/api';
import { logger } from '@/shared/lib/logger';

/**
 * Authenticates against admin-rpc through the gateway. The browser receives a
 * short-lived signed JWT but never sees the configured backend credentials or
 * signing secret.
 */
export const login = async (input: TLoginInput): Promise<TAuthSession> => {
  try {
    const response = await authApiClient.login(input);
    const session = ZAuthSession.safeParse(response);
    if (!session.success) throw new Error('Invalid authentication response');
    return session.data;
  } catch (error) {
    if (error instanceof ConnectError && error.code === Code.Unauthenticated) {
      throw new AuthError('invalid_credentials', 'Invalid email or password.');
    }
    logger.error('Authentication request failed', error);
    throw new AuthError(
      'service_unavailable',
      'Authentication is temporarily unavailable.',
    );
  }
};
