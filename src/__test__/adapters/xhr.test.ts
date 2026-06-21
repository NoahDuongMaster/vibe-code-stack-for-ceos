import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();

vi.mock('ofetch', () => ({
  $fetch: (...args: unknown[]) => mockFetch(...args),
  FetchError: class FetchError extends Error {
    status?: number;
    constructor(message: string, opts?: { status?: number }) {
      super(message);
      this.status = opts?.status;
    }
  },
}));

vi.mock('@/shared/config/env.configuration', () => ({
  env: { client: { NEXT_PUBLIC_API_ENDPOINT: 'http://localhost:3000' } },
}));

vi.mock('@/shared/config/jwt.configuration', () => ({
  jwt: {
    accessToken: { key: 'access_token' },
    refreshToken: { key: 'refresh_token' },
  },
}));

vi.mock('@/shared/constants/routes.constant', () => ({
  WEB_ROUTES: { SIGN_IN: '/sign-in' },
  API_ROUTES: {},
}));

describe('Request (xhr adapter)', () => {
  // Import after mocks are registered
  let Request: typeof import('@/shared/lib/xhr')['Request'];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ Request } = await import('@/shared/lib/xhr'));
  });

  it('get() calls $fetch with GET method and query params', async () => {
    mockFetch.mockResolvedValue({ items: [], total: 0 });
    const req = new Request();
    const result = await req.get('/api/posts', { page: 1, limit: 10 });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/posts',
      expect.objectContaining({
        method: 'GET',
        params: { page: 1, limit: 10 },
      }),
    );
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('post() calls $fetch with POST method and body', async () => {
    const created = { id: 'abc', title: 'Hello' };
    mockFetch.mockResolvedValue(created);
    const req = new Request();
    const result = await req.post('/api/posts', {
      title: 'Hello',
      body: 'World',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/posts',
      expect.objectContaining({
        method: 'POST',
        body: { title: 'Hello', body: 'World' },
      }),
    );
    expect(result).toEqual(created);
  });

  it('put() calls $fetch with PUT method', async () => {
    mockFetch.mockResolvedValue({ updated: true });
    const req = new Request();
    await req.put('/api/posts/1', { title: 'Updated' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/posts/1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('patch() calls $fetch with PATCH method', async () => {
    mockFetch.mockResolvedValue({ patched: true });
    const req = new Request();
    await req.patch('/api/posts/1', { status: 'published' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/posts/1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('delete() calls $fetch with DELETE method', async () => {
    mockFetch.mockResolvedValue(null);
    const req = new Request();
    await req.delete('/api/posts/1');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/posts/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('includes Authorization header when access token exists', async () => {
    mockFetch.mockResolvedValue({});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) =>
        key === 'access_token' ? 'bearer-token-xyz' : null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const req = new Request();
    await req.get('/api/protected');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/protected',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer bearer-token-xyz',
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('omits Authorization header when no token', async () => {
    mockFetch.mockResolvedValue({});
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const req = new Request();
    await req.get('/api/public');

    expect(mockFetch.mock.calls[0]).toBeDefined();
    const opts = mockFetch.mock.calls[0]?.[1] as Record<string, unknown>;
    const headers = opts.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('returns null for tokens when window is undefined (server-side)', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error -- simulate server environment
    delete globalThis.window;

    vi.resetModules();
    const { Request: ServerRequest } = await import('@/shared/lib/xhr');

    mockFetch.mockResolvedValue({ ok: true });
    const req = new ServerRequest();
    await req.get('/api/server-route');

    const opts = mockFetch.mock.calls[0]?.[1] as Record<string, unknown>;
    const headers = opts.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBeUndefined();

    globalThis.window = originalWindow;
  });
});

describe('Request – fallback base URL', () => {
  let Request: typeof import('@/shared/lib/xhr')['Request'];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock('@/shared/config/env.configuration', () => ({
      env: { client: { NEXT_PUBLIC_API_ENDPOINT: null } },
    }));

    ({ Request } = await import('@/shared/lib/xhr'));
  });

  it('uses empty string as baseURL when NEXT_PUBLIC_API_ENDPOINT is null', async () => {
    mockFetch.mockResolvedValue({ data: 'ok' });
    const req = new Request();
    await req.get('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ baseURL: '' }),
    );
  });
});
