import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/__test__/setup/server';
import { fetchSession } from '@/entities/session/api/session.api';
import { API_ROUTES } from '@/shared/routes';

describe('fetchSession', () => {
  it('should return the session payload on success', async () => {
    const session = {
      isLoggedIn: true,
      user: { id: '1', email: 'demo@example.com', name: 'Demo User' },
    };
    server.use(http.get(API_ROUTES.AUTH_ME, () => HttpResponse.json(session)));

    await expect(fetchSession()).resolves.toEqual(session);
  });

  it('should return isLoggedIn: false when the request fails', async () => {
    server.use(
      http.get(
        API_ROUTES.AUTH_ME,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    await expect(fetchSession()).resolves.toEqual({ isLoggedIn: false });
  });
});
