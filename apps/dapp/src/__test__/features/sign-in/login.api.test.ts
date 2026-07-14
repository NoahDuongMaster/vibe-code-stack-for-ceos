import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/__test__/setup/server';
import { login } from '@/features/sign-in/api/login.api';
import { AuthError } from '@/features/sign-in/model/login.error';
import { API_ROUTES } from '@/shared/routes';

describe('login', () => {
  it('should resolve without throwing on success', async () => {
    server.use(
      http.post(API_ROUTES.AUTH_LOGIN, () =>
        HttpResponse.json({ success: true }),
      ),
    );

    await expect(
      login({ email: 'demo@example.com', password: 'secret' }),
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

    const promise = login({
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

    const promise = login({
      email: 'demo@example.com',
      password: 'secret',
    });

    await expect(promise).rejects.toBeInstanceOf(AuthError);
    await expect(promise).rejects.toMatchObject({ code: 'request_failed' });
  });
});
