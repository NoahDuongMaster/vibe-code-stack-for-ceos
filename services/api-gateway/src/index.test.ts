import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const ECHO_URL = 'http://gateway.test/api.v1.ApiService/Echo';

describe('gateway fetch handler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should serve a known route locally', async () => {
    const res = await worker.fetch(
      new Request(ECHO_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'edge' }),
      }),
      {},
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { upper: string; runtime: string };
    expect(body.upper).toBe('EDGE');
    expect(body.runtime).toBe('cloudflare-workers');
  });

  it('should not rate-limit when RATE_LIMITER is unbound (local dev)', async () => {
    const res = await worker.fetch(
      new Request(ECHO_URL, { method: 'GET' }),
      {},
    );
    // Reaches the real handler (404 for GET on this route) instead of
    // short-circuiting — proves the missing-binding guard works.
    expect(res.status).not.toBe(429);
  });

  it('should return 429 when RATE_LIMITER reports the client is over budget', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });

    const res = await worker.fetch(new Request(ECHO_URL, { method: 'GET' }), {
      RATE_LIMITER: { limit },
    });

    expect(limit).toHaveBeenCalledWith({ key: 'unknown' });
    expect(res.status).toBe(429);
  });

  it('should key the rate limit on cf-connecting-ip and pass through when under budget', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });

    const res = await worker.fetch(
      new Request(ECHO_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
          'cf-connecting-ip': '203.0.113.7',
        },
        body: JSON.stringify({ message: 'edge' }),
      }),
      { RATE_LIMITER: { limit } },
    );

    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(res.status).toBe(200);
  });

  it('should annotate a locally-served response with CORS headers for an allowed origin', async () => {
    const res = await worker.fetch(
      new Request(ECHO_URL, {
        method: 'OPTIONS',
        headers: { origin: 'https://admin.example.com' },
      }),
      { CORS_ORIGINS: 'https://admin.example.com, https://dapp.example.com' },
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://admin.example.com',
    );
  });

  it('should 404 an unknown route when no UPSTREAM_URL is configured', async () => {
    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist'),
      {},
    );

    expect(res.status).toBe(404);
  });

  it('should proxy an unknown route to UPSTREAM_URL when configured', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        input instanceof Request
          ? input.url
          : (input as string | URL).toString();
      return new Response('upstream body', {
        status: 200,
        headers: { 'x-served-by': url },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist'),
      {
        UPSTREAM_URL: 'https://api-node.internal',
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('upstream body');
    // Path + query are preserved; only the scheme/host swap to the upstream's.
    expect(res.headers.get('x-served-by')).toBe(
      'https://api-node.internal/does-not-exist',
    );
  });

  it("should stamp a proxied response with the gateway's own CORS decision, overriding the upstream's", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('upstream body', {
          status: 200,
          headers: {
            // Simulates api-node answering with a DIFFERENT (or absent)
            // CORS decision than the gateway's — the gateway must win.
            'access-control-allow-origin': 'https://untrusted.example.com',
          },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist', {
        headers: { origin: 'https://admin.example.com' },
      }),
      {
        UPSTREAM_URL: 'https://api-node.internal',
        CORS_ORIGINS: 'https://admin.example.com',
      },
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('upstream body');
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://admin.example.com',
    );
  });

  it('should not add CORS headers to a proxied response when the origin is not allowed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('upstream body', { status: 200 })),
    );

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist', {
        headers: { origin: 'https://evil.example.com' },
      }),
      {
        UPSTREAM_URL: 'https://api-node.internal',
        CORS_ORIGINS: 'https://admin.example.com',
      },
    );

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('should return 502 when the upstream fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network error');
      }),
    );

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist'),
      { UPSTREAM_URL: 'https://api-node.internal' },
    );

    expect(res.status).toBe(502);
  });

  it('should return 504 when the upstream fetch times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const error = new Error('The operation was aborted.');
        error.name = 'TimeoutError';
        throw error;
      }),
    );

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist'),
      { UPSTREAM_URL: 'https://api-node.internal' },
    );

    expect(res.status).toBe(504);
  });

  it('should not proxy known/locally-handled routes even when UPSTREAM_URL is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await worker.fetch(
      new Request(ECHO_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'edge' }),
      }),
      { UPSTREAM_URL: 'https://api-node.internal' },
    );

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
