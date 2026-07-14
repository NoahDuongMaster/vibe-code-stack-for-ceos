import { FetchError, xhr } from '@/shared/api';
import { API_ROUTES } from '@/shared/routes';
import { AuthError } from '../model/login.error';
import type { TLoginInput } from '../model/login.schema';

/**
 * Signs in through the app's same-origin BFF route, which owns the httpOnly
 * session cookie. The shared client intentionally resolves this relative path
 * against the current origin.
 */
export const login = async (input: TLoginInput): Promise<void> => {
  try {
    await xhr(API_ROUTES.AUTH_LOGIN, { method: 'POST', body: input });
  } catch (error) {
    if (error instanceof FetchError && error.status === 401) {
      throw new AuthError(
        'invalid_credentials',
        'Incorrect email or password.',
      );
    }
    throw new AuthError(
      'request_failed',
      'Login request failed. Please try again.',
    );
  }
};
