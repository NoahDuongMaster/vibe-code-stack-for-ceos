import { Code, ConnectError, type Interceptor } from '@connectrpc/connect';
import { createAdminClient, createApiClient } from '@packages/api-client';
import { emitUnauthenticated } from '@/shared/api/auth-events';
import { getAuthToken } from '@/shared/api/auth-token';
import { API_URL } from '@/shared/config';

// Attaches the current session token (if any) to every RPC, and signals
// `shared/api/auth-events` when the backend rejects it as unauthenticated —
// the App layer subscribes to that signal to sign out and
// redirect to /login. This runs for every slice API that uses `apiClient`, so
// higher layers never have to wire auth handling themselves.
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

/** Shared Connect RPC client — every slice API should reuse this client. */
export const apiClient = createApiClient(API_URL, {
  interceptors: [authInterceptor],
});

/** Admin facade client — always targets api-gateway, never admin-rpc directly. */
export const adminApiClient = createAdminClient(API_URL, {
  interceptors: [authInterceptor],
});
