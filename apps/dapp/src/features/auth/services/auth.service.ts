import { getSessionAPI, loginAPI } from '../adapters/auth.adapter';
import type { TLoginInput } from '../schemas/auth.schema';

/**
 * Client-side auth orchestration. Business logic lives here; the adapters own
 * the HTTP calls and the hooks own the React/cache wiring.
 */
export const authService = {
  getSession: () => getSessionAPI(),
  login: (input: TLoginInput) => loginAPI(input),
};
