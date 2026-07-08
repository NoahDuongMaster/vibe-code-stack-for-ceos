import { API_ROUTES } from '@/shared/constants/routes.constant';
import { FetchError, xhr } from '@/shared/lib/xhr';
import { AuthError } from '../errors/auth.error';
import type { TLoginInput, TSessionData } from '../schemas/auth.schema';

/**
 * Auth adapters hit the app's OWN same-origin BFF route handlers (which
 * manage the httpOnly iron-session cookie) — not an external data API. The
 * shared `xhr` client has no `baseURL` configured, so relative paths here
 * resolve same-origin exactly like the old raw `fetch()` calls did.
 */

export const getSessionAPI = async (): Promise<TSessionData> => {
  try {
    return await xhr<TSessionData>(API_ROUTES.AUTH_ME);
  } catch {
    return { isLoggedIn: false };
  }
};

export const loginAPI = async (input: TLoginInput): Promise<void> => {
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
