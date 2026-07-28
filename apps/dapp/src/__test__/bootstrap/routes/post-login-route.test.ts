import { env as cloudflareEnv } from 'cloudflare:workers';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { postLogin as POST } from '@/bootstrap/routes/post-login-route';
import { getMutableSession } from '@/entities/session/index.server';
import { verifyCredentials } from '@/features/sign-in/index.server';

// Factory-based mocks — a bare `vi.mock(path)` auto-mock still evaluates the
// real module first, which would run session/sign-in's real
// shared config validation in a test process where the required env
// vars aren't set.
vi.mock('@/features/sign-in/index.server', () => ({
  verifyCredentials: vi.fn(),
  ZLoginInput: z.object({
    email: z.email(),
    password: z.string().min(1),
  }),
}));
vi.mock('@/entities/session/index.server', () => ({
  getMutableSession: vi.fn(),
}));
vi.mock('@/shared/config', () => ({
  env: { server: { DAPP_LOGIN_RATE_LIMIT_MODE: undefined } },
}));

const LOGIN_URL = 'http://localhost:46000/api/auth/login';

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
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    delete (cloudflareEnv as Record<string, unknown>).LOGIN_RATE_LIMITER;
    saveMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getMutableSession).mockResolvedValue({
      isLoggedIn: false,
      save: saveMock,
    } as unknown as Awaited<ReturnType<typeof getMutableSession>>);
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

  it('should use the distributed limiter and reject a denied production request', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const limit = vi.fn().mockResolvedValue({ success: false });
    const get = vi.fn().mockReturnValue({ limit });
    const idFromName = vi.fn().mockReturnValue('durable-object-id');
    (cloudflareEnv as Record<string, unknown>).LOGIN_RATE_LIMITER = {
      get,
      idFromName,
    };

    const response = await POST(
      makeRequest(
        { email: 'demo@example.com', password: 'wrong' },
        { 'cf-connecting-ip': '203.0.113.10' },
      ),
    );

    expect(response.status).toBe(429);
    expect(idFromName).toHaveBeenCalledWith('dapp-login:203.0.113.10');
    expect(get).toHaveBeenCalledWith('durable-object-id');
    expect(limit).toHaveBeenCalledWith({ limit: 10, periodMs: 60_000 });
    expect(verifyCredentials).not.toHaveBeenCalled();
  });

  it('should fail closed when the production limiter binding is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await POST(
      makeRequest(
        { email: 'demo@example.com', password: 'correct' },
        { 'cf-connecting-ip': '203.0.113.11' },
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Authentication is temporarily unavailable',
    });
    expect(verifyCredentials).not.toHaveBeenCalled();
  });
});
