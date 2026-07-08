import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/__test__/setup/server';
import { getSessionAPI, loginAPI } from '@/features/auth/adapters/auth.adapter';
import { AuthError } from '@/features/auth/errors/auth.error';
import { API_ROUTES } from '@/shared/constants/routes.constant';

describe('auth.adapter', () => {
  describe('getSessionAPI', () => {
    it('should return the session payload on success', async () => {
      const session = {
        isLoggedIn: true,
        user: { id: '1', email: 'demo@example.com', name: 'Demo User' },
      };
      server.use(
        http.get(API_ROUTES.AUTH_ME, () => HttpResponse.json(session)),
      );

      await expect(getSessionAPI()).resolves.toEqual(session);
    });

    it('should return isLoggedIn: false when the request fails', async () => {
      server.use(
        http.get(
          API_ROUTES.AUTH_ME,
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      await expect(getSessionAPI()).resolves.toEqual({ isLoggedIn: false });
    });
  });

  describe('loginAPI', () => {
    it('should resolve without throwing on success', async () => {
      server.use(
        http.post(API_ROUTES.AUTH_LOGIN, () =>
          HttpResponse.json({ success: true }),
        ),
      );

      await expect(
        loginAPI({ email: 'demo@example.com', password: 'secret' }),
      ).resolves.toBeUndefined();
    });

    it('should map a 401 response to AuthError("invalid_credentials")', async () => {
      server.use(
        http.post(
          API_ROUTES.AUTH_LOGIN,
          () =>
            new HttpResponse(
              JSON.stringify({ error: 'Invalid email or password' }),
              { status: 401 },
            ),
        ),
      );

      const promise = loginAPI({
        email: 'demo@example.com',
        password: 'wrong',
      });

      await expect(promise).rejects.toBeInstanceOf(AuthError);
      await expect(promise).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
    });

    it('should map any other failure to AuthError("request_failed")', async () => {
      server.use(
        http.post(
          API_ROUTES.AUTH_LOGIN,
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      const promise = loginAPI({
        email: 'demo@example.com',
        password: 'secret',
      });

      await expect(promise).rejects.toBeInstanceOf(AuthError);
      await expect(promise).rejects.toMatchObject({ code: 'request_failed' });
    });
  });
});
