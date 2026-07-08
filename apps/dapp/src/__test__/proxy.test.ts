import { sealData } from 'iron-session';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import proxy from '@/proxy';
import { SESSION_COOKIE_NAME } from '@/shared/constants/session.constant';

const SESSION_SECRET = 'test-session-secret-min-32-chars!!';

vi.mock('@/shared/config/env.configuration', () => ({
  env: { server: { SESSION_SECRET: 'test-session-secret-min-32-chars!!' } },
}));

const sealSession = (data: unknown) =>
  sealData(data, { password: SESSION_SECRET });

describe('proxy middleware', () => {
  it('should allow unauthenticated requests to public routes', async () => {
    const req = new NextRequest('http://localhost:3000/');

    const res = await proxy(req);

    expect(res.status).toBe(200);
  });

  it('should redirect unauthenticated requests to /account to /sign-in with a callbackUrl', async () => {
    const req = new NextRequest('http://localhost:3000/account');

    const res = await proxy(req);

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.pathname).toBe('/sign-in');
    expect(location.searchParams.get('callbackUrl')).toBe('/account');
  });

  it('should reject a request with a forged/garbage session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/account', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=not-a-real-sealed-value` },
    });

    const res = await proxy(req);

    expect(res.status).toBe(307);
  });

  it('should reject a validly sealed but logged-out session cookie', async () => {
    const sealed = await sealSession({ isLoggedIn: false });
    const req = new NextRequest('http://localhost:3000/account', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sealed}` },
    });

    const res = await proxy(req);

    expect(res.status).toBe(307);
  });

  it('should allow a request with a validly sealed, logged-in session cookie', async () => {
    const sealed = await sealSession({
      isLoggedIn: true,
      user: { id: '1', email: 'demo@example.com' },
    });
    const req = new NextRequest('http://localhost:3000/account', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sealed}` },
    });

    const res = await proxy(req);

    expect(res.status).toBe(200);
  });
});
