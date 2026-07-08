import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Shared MSW server for unit/integration tests. Register per-test handlers with
 * `server.use(...)`; any un-mocked request throws so missing mocks fail loudly.
 *
 *   import { server } from '@/__test__/setup/server'
 *   server.use(http.get(API_ROUTES.GET_USER, () => HttpResponse.json(user)))
 */
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
