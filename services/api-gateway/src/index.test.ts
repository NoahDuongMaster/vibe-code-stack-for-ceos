import { sign } from 'hono/jwt';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { createGatewayWorker, type RateLimiterDO } from '@/index';

const ECHO_URL = 'http://gateway.test/api.v1.ApiService/Echo';
const HEALTH_URL = 'http://gateway.test/api.v1.ApiService/Health';
const MARKETS_URL = 'http://gateway.test/trading.v1.TradingService/GetMarkets';
const JWT_SECRET = 'test-secret';

/** A Connect-style RPC POST (JSON) helper, optionally bearer-authenticated. */
function rpcRequest(url: string, body: unknown, token?: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'connect-protocol-version': '1',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Mocks the RateLimiterDO binding: namespace.get(idFromName(key)).limit(). */
function mockRateLimiter(success: boolean) {
  const limit = vi.fn(async () => ({ success, remaining: success ? 42 : 0 }));
  const idFromName = vi.fn((name: string) => name);
  const get = vi.fn(() => ({ limit }));
  const namespace = {
    idFromName,
    get,
  } as unknown as DurableObjectNamespace<RateLimiterDO>;
  return { namespace, idFromName, get, limit };
}

describe('gateway fetch handler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should serve a known route locally', async () => {
    const res = await worker.fetch(
      rpcRequest(ECHO_URL, { message: 'edge' }),
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

  it('should return 429 when the rate limiter reports the client is over budget', async () => {
    const { namespace, idFromName, limit } = mockRateLimiter(false);

    const res = await worker.fetch(new Request(ECHO_URL, { method: 'GET' }), {
      RATE_LIMITER: namespace,
    });

    // One Durable Object instance per client key; 'unknown' when no CF IP.
    expect(idFromName).toHaveBeenCalledWith('unknown');
    expect(limit).toHaveBeenCalledWith({ limit: 300, periodMs: 60_000 });
    expect(res.status).toBe(429);
  });

  it('should key the rate limit on cf-connecting-ip and pass through when under budget', async () => {
    const { namespace, idFromName } = mockRateLimiter(true);

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
      { RATE_LIMITER: namespace },
    );

    expect(idFromName).toHaveBeenCalledWith('203.0.113.7');
    expect(res.status).toBe(200);
  });

  it('should fail open (allow the request) when the rate limiter throws', async () => {
    const warningSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const limit = vi.fn(async () => {
      throw new Error('rate limiter unavailable');
    });
    const namespace = {
      idFromName: vi.fn((name: string) => name),
      get: vi.fn(() => ({ limit })),
    } as unknown as DurableObjectNamespace<RateLimiterDO>;

    const res = await worker.fetch(rpcRequest(ECHO_URL, { message: 'edge' }), {
      RATE_LIMITER: namespace,
    });

    expect(res.status).toBe(200);
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"rate_limiter_unavailable"'),
    );
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

  it('should 404 an unknown route when TRADING_RPC is unbound', async () => {
    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist'),
      {},
    );

    expect(res.status).toBe(404);
  });

  it('should log invalid runtime configuration without exposing its cause', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const res = await createGatewayWorker().fetch(
      new Request('http://gateway.test/crypto'),
      {
        ENVIRONMENT: 'development',
        LOCAL_TRADING_RPC_URL: 'ftp://127.0.0.1:3001',
      },
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'internal', message: 'Internal Server Error' },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"service":"api-gateway"'),
    );
  });

  it('should proxy an unhandled route to LOCAL_TRADING_RPC_URL in development', async () => {
    const fetchMock = vi.fn(async function (
      this: unknown,
      input: RequestInfo | URL,
    ) {
      expect(this).toBe(globalThis);
      const request = input as Request;
      return new Response('local trading-rpc', {
        headers: { 'x-target': request.url },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await worker.fetch(
      new Request('http://gateway.test/crypto?currency=usd'),
      {
        ENVIRONMENT: 'development',
        LOCAL_TRADING_RPC_URL: 'http://127.0.0.1:3001',
      },
    );

    expect(await res.text()).toBe('local trading-rpc');
    expect(res.headers.get('x-target')).toBe(
      'http://127.0.0.1:3001/crypto?currency=usd',
    );
  });

  it('should not honor LOCAL_TRADING_RPC_URL outside development', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await worker.fetch(new Request('http://gateway.test/crypto'), {
      ENVIRONMENT: 'production',
      LOCAL_TRADING_RPC_URL: 'http://127.0.0.1:3001',
    });

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should proxy an unknown route through the TRADING_RPC VPC binding', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;
      return new Response('trading-rpc body', {
        status: 200,
        headers: { 'x-served-by': request.url },
      });
    });
    const tradingRpc = { fetch } as unknown as Fetcher;

    const res = await worker.fetch(
      new Request('http://gateway.test/crypto?currency=usd'),
      { TRADING_RPC: tradingRpc },
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('trading-rpc body');
    expect(res.headers.get('x-served-by')).toBe(
      'http://trading-rpc.internal/crypto?currency=usd',
    );
  });

  it('should proxy TradingService without handling it at the edge', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;
      return new Response('trading-rpc body', {
        status: 200,
        headers: { 'x-served-by': request.url },
      });
    });

    const res = await worker.fetch(
      rpcRequest(MARKETS_URL, { coinIds: ['bitcoin'], vsCurrency: 'usd' }),
      { TRADING_RPC: { fetch } as unknown as Fetcher },
    );

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    expect(res.headers.get('x-served-by')).toBe(
      'http://trading-rpc.internal/trading.v1.TradingService/GetMarkets',
    );
  });

  it("should stamp a VPC response with the gateway's own CORS decision", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('upstream body', {
          status: 200,
          headers: {
            // The VPC service's own CORS decision must never reach browsers.
            'access-control-allow-origin': 'https://untrusted.example.com',
          },
        }),
    );

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist', {
        headers: { origin: 'https://admin.example.com' },
      }),
      {
        TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher,
        CORS_ORIGINS: 'https://admin.example.com',
      },
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('upstream body');
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://admin.example.com',
    );
  });

  it('should not add CORS headers to a VPC response when the origin is not allowed', async () => {
    const fetchMock = vi.fn(
      async () => new Response('upstream body', { status: 200 }),
    );

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist', {
        headers: { origin: 'https://evil.example.com' },
      }),
      {
        TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher,
        CORS_ORIGINS: 'https://admin.example.com',
      },
    );

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('should return 502 when the VPC binding fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network error');
    });

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist'),
      { TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher },
    );

    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'bad_gateway',
    );
  });

  it('should return 504 when the VPC binding fetch times out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => {
      const error = new Error('The operation was aborted.');
      error.name = 'TimeoutError';
      throw error;
    });

    const res = await worker.fetch(
      new Request('http://gateway.test/does-not-exist'),
      { TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher },
    );

    expect(res.status).toBe(504);
  });

  it('should not proxy known/locally-handled routes when TRADING_RPC is bound', async () => {
    const fetchMock = vi.fn();

    const res = await worker.fetch(rpcRequest(ECHO_URL, { message: 'edge' }), {
      TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher,
    });

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should serve a gateway liveness endpoint that bypasses auth', async () => {
    const res = await worker.fetch(
      new Request('http://gateway.test/healthz'),
      { JWT_SECRET }, // auth enabled, but /healthz is public
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('should set an X-Request-Id header on every response', async () => {
    const res = await worker.fetch(
      new Request('http://gateway.test/healthz'),
      {},
    );

    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('should reject a protected route with 401 when a token is required but missing', async () => {
    const res = await worker.fetch(rpcRequest(ECHO_URL, { message: 'edge' }), {
      JWT_SECRET,
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  it('should allow a protected route with a valid bearer token', async () => {
    const token = await sign({ sub: 'user-1' }, JWT_SECRET);

    const res = await worker.fetch(
      rpcRequest(ECHO_URL, { message: 'edge' }, token),
      { JWT_SECRET },
    );

    expect(res.status).toBe(200);
    expect(((await res.json()) as { upper: string }).upper).toBe('EDGE');
  });

  it('should keep the Health route public even when auth is enabled', async () => {
    const res = await worker.fetch(rpcRequest(HEALTH_URL, {}), { JWT_SECRET });

    expect(res.status).toBe(200);
  });
});
