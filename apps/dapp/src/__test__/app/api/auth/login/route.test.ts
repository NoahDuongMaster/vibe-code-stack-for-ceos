import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { verifyCredentials } from '@/server/lib/auth';
import { getSession } from '@/server/lib/session';

// Factory-based mocks — a bare `vi.mock(path)` auto-mock still evaluates the
// real module first, which would run session.ts/auth.ts's real
// env.configuration.ts validation in a test process where the required env
// vars aren't set.
vi.mock('@/server/lib/auth', () => ({ verifyCredentials: vi.fn() }));
vi.mock('@/server/lib/session', () => ({ getSession: vi.fn() }));

const LOGIN_URL = 'http://localhost:3000/api/auth/login';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(LOGIN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  let saveMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    saveMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getSession).mockResolvedValue({
      isLoggedIn: false,
      save: saveMock,
    } as unknown as Awaited<ReturnType<typeof getSession>>);
  });

  it('should return 400 for a malformed JSON body', async () => {
    const req = makeRequest('{not json', { 'x-forwarded-for': '10.0.0.1' });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('should return 400 for a body that fails schema validation', async () => {
    const req = makeRequest(
      { email: 'not-an-email', password: '' },
      { 'x-forwarded-for': '10.0.0.2' },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('should return 401 when credentials are invalid', async () => {
    vi.mocked(verifyCredentials).mockResolvedValue(null);
    const req = makeRequest(
      { email: 'demo@example.com', password: 'wrong' },
      { 'x-forwarded-for': '10.0.0.3' },
    );

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('should save the session and return 200 on success', async () => {
    const user = { id: '1', email: 'demo@example.com', name: 'Demo User' };
    vi.mocked(verifyCredentials).mockResolvedValue(user);
    const req = makeRequest(
      { email: 'demo@example.com', password: 'correct' },
      { 'x-forwarded-for': '10.0.0.4' },
    );

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it('should return 429 after exceeding the rate limit for one client', async () => {
    vi.mocked(verifyCredentials).mockResolvedValue(null);
    const headers = { 'x-forwarded-for': '10.0.0.5' };

    for (let i = 0; i < 10; i += 1) {
      const res = await POST(
        makeRequest({ email: 'demo@example.com', password: 'wrong' }, headers),
      );
      expect(res.status).toBe(401);
    }

    const blocked = await POST(
      makeRequest({ email: 'demo@example.com', password: 'wrong' }, headers),
    );

    expect(blocked.status).toBe(429);
  });
});
