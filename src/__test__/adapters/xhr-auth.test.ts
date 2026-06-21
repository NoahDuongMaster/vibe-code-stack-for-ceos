import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();

class MockFetchError extends Error {
  status?: number;
  constructor(message: string, opts?: { status?: number }) {
    super(message);
    this.status = opts?.status;
  }
}

vi.mock('ofetch', () => ({
  $fetch: (...args: unknown[]) => mockFetch(...args),
  FetchError: MockFetchError,
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

describe('Request – token refresh & 401 retry', () => {
  let Request: typeof import('@/shared/lib/xhr')['Request'];
  const mockReplace = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal('window', {
      ...globalThis.window,
      localStorage: globalThis.localStorage,
      location: { replace: mockReplace },
    });

    ({ Request } = await import('@/shared/lib/xhr'));
  });

  it('retries with new token on 401 after successful refresh', async () => {
    localStorage.setItem('access_token', 'expired-token');
    localStorage.setItem('refresh_token', 'valid-refresh');

    const error401 = new MockFetchError('Unauthorized', { status: 401 });

    mockFetch
      .mockRejectedValueOnce(error401)
      .mockResolvedValueOnce({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        },
      })
      .mockResolvedValueOnce({ id: 1, name: 'Protected Data' });

    const req = new Request();
    const result = await req.get('/api/protected');

    expect(result).toEqual({ id: 1, name: 'Protected Data' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('access_token')).toBe('new-access-token');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
  });

  it('redirects to sign-in when no refresh token on 401', async () => {
    localStorage.setItem('access_token', 'expired-token');

    const error401 = new MockFetchError('Unauthorized', { status: 401 });
    mockFetch.mockRejectedValueOnce(error401);

    const req = new Request();
    await expect(req.get('/api/protected')).rejects.toThrow();

    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('redirects to sign-in when refresh returns invalid data', async () => {
    localStorage.setItem('access_token', 'expired');
    localStorage.setItem('refresh_token', 'some-refresh');

    const error401 = new MockFetchError('Unauthorized', { status: 401 });
    mockFetch
      .mockRejectedValueOnce(error401)
      .mockResolvedValueOnce({ data: {} });

    const req = new Request();
    await expect(req.get('/api/protected')).rejects.toThrow();

    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('redirects when refresh request itself fails', async () => {
    localStorage.setItem('access_token', 'expired');
    localStorage.setItem('refresh_token', 'bad-refresh');

    const error401 = new MockFetchError('Unauthorized', { status: 401 });
    mockFetch
      .mockRejectedValueOnce(error401)
      .mockRejectedValueOnce(new Error('Refresh failed'));

    const req = new Request();
    await expect(req.get('/api/protected')).rejects.toThrow();

    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('throws non-401 errors without attempting refresh', async () => {
    localStorage.setItem('access_token', 'valid-token');

    const error500 = new MockFetchError('Server Error', { status: 500 });
    mockFetch.mockRejectedValueOnce(error500);

    const req = new Request();
    await expect(req.get('/api/broken')).rejects.toThrow('Server Error');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('throws non-FetchError errors without attempting refresh', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network failure'));

    const req = new Request();
    await expect(req.get('/api/offline')).rejects.toThrow('Network failure');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('delete() with params works correctly', async () => {
    mockFetch.mockResolvedValue({ deleted: true });
    const req = new Request();
    await req.delete('/api/items/1', { force: true });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/items/1',
      expect.objectContaining({ method: 'DELETE', params: { force: true } }),
    );
  });
});

describe('Request – server-side 401 (no window)', () => {
  it('skips refresh when window is undefined and re-throws 401', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error -- simulate server environment
    delete globalThis.window;

    vi.clearAllMocks();
    vi.resetModules();

    const { Request: ServerRequest } = await import('@/shared/lib/xhr');

    const error401 = new MockFetchError('Unauthorized', { status: 401 });
    mockFetch.mockRejectedValueOnce(error401);

    const req = new ServerRequest();
    await expect(req.get('/api/protected')).rejects.toThrow('Unauthorized');

    expect(mockFetch).toHaveBeenCalledTimes(1);

    globalThis.window = originalWindow;
  });
});
