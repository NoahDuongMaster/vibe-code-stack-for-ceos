import { Code, ConnectError, type Interceptor } from '@connectrpc/connect';
import { createApiClient } from '@repo/api-client';
import { API_URL } from '@/shared/config/env';
import { emitUnauthenticated } from './auth-events';
import { getAuthToken } from './auth-token';

// Attaches the current session token (if any) to every RPC, and signals
// `shared/lib/auth-events` when the backend rejects it as unauthenticated —
// `features/auth` subscribes to that signal at the app root to sign out and
// redirect to /login. This runs for every adapter that uses `apiClient`
// below, so new features never have to wire auth handling themselves.
const authInterceptor: Interceptor = (next) => async (req) => {
  const token = getAuthToken();
  if (token) {
    req.header.set('Authorization', `Bearer ${token}`);
  }
  try {
    return await next(req);
  } catch (error) {
    if (error instanceof ConnectError && error.code === Code.Unauthenticated) {
      emitUnauthenticated();
    }
    throw error;
  }
};

/** Shared Connect RPC client — every feature adapter should use this instead of calling `createApiClient` directly. */
export const apiClient = createApiClient(API_URL, {
  interceptors: [authInterceptor],
});
