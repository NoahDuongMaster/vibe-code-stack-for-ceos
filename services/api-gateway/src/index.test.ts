import { sign } from 'hono/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TGatewayBindings } from '@/adapters/cloudflare/gateway-bindings';
import worker, { createGatewayWorker, type RateLimiterDO } from '@/index';

const HEALTH_URL = 'http://gateway.test/health.v1.HealthService/Health';
const MARKETS_URL = 'http://gateway.test/trading.v1.TradingService/GetMarkets';
const PROTECTED_URL = 'http://gateway.test/private.v1.PrivateService/Read';
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

const gatewayBindings = (
  overrides: Partial<TGatewayBindings> = {},
): TGatewayBindings => ({
  SERVICE_NAME: 'gateway-test',
  TRADING_RPC: {
    fetch: vi.fn(async () => new Response('Not Found', { status: 404 })),
  } as unknown as Fetcher,
  ...overrides,
});

const fetchGateway = (
  request: Request,
  bindings: Partial<TGatewayBindings> = {},
): Promise<Response> =>
  Promise.resolve(worker.fetch(request, gatewayBindings(bindings)));

describe('gateway fetch handler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should serve a known route locally', async () => {
    const res = await fetchGateway(rpcRequest(HEALTH_URL, {}), {});

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      service: 'gateway-test',
      runtime: 'cloudflare-workers',
    });
  });

  it('should not rate-limit when RATE_LIMITER is unbound (local dev)', async () => {
    const res = await fetchGateway(
      new Request(MARKETS_URL, { method: 'GET' }),
      {},
    );
    // Reaches the real handler (404 for GET on this route) instead of
    // short-circuiting — proves the missing-binding guard works.
    expect(res.status).not.toBe(429);
  });

  it('should return 429 when the rate limiter reports the client is over budget', async () => {
    const { namespace, idFromName, limit } = mockRateLimiter(false);

    const res = await fetchGateway(
      new Request(MARKETS_URL, { method: 'GET' }),
      { RATE_LIMITER: namespace },
    );

    // One Durable Object instance per client key; 'unknown' when no CF IP.
    expect(idFromName).toHaveBeenCalledWith('unknown');
    expect(limit).toHaveBeenCalledWith({ limit: 300, periodMs: 60_000 });
    expect(res.status).toBe(429);
  });

  it('should key the rate limit on cf-connecting-ip and pass through when under budget', async () => {
    const { namespace, idFromName } = mockRateLimiter(true);

    const res = await fetchGateway(
      new Request(MARKETS_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
          'cf-connecting-ip': '203.0.113.7',
        },
        body: JSON.stringify({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
      }),
      {
        RATE_LIMITER: namespace,
        TRADING_RPC: {
          fetch: vi.fn(async () => new Response('ok')),
        } as unknown as Fetcher,
      },
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

    const res = await fetchGateway(
      rpcRequest(MARKETS_URL, { coinIds: ['bitcoin'], vsCurrency: 'usd' }),
      {
        RATE_LIMITER: namespace,
        TRADING_RPC: {
          fetch: vi.fn(async () => new Response('ok')),
        } as unknown as Fetcher,
      },
    );

    expect(res.status).toBe(200);
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"rate_limiter_unavailable"'),
    );
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('"service":"gateway-test"'),
    );
  });

  it('should annotate a locally-served response with CORS headers for an allowed origin', async () => {
    const res = await fetchGateway(
      new Request(HEALTH_URL, {
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

  it('should log invalid runtime configuration without exposing its cause', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const res = await createGatewayWorker().fetch(
      new Request('http://gateway.test/crypto'),
      gatewayBindings({
        SERVICE_NAME: 'invalid-config-gateway',
        ENVIRONMENT: 'development',
        CORS_ORIGINS: 'not-an-origin',
      }),
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'internal', message: 'Internal Server Error' },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"request_error"'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.not.stringContaining('"service"'),
    );
  });

  it('should reject a request when SERVICE_NAME is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await createGatewayWorker().fetch(
      new Request('http://gateway.test/healthz'),
      {} as TGatewayBindings,
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'internal', message: 'Internal Server Error' },
    });
  });

  it('should reject every request when the TRADING_RPC VPC binding is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await createGatewayWorker().fetch(
      new Request('http://gateway.test/healthz'),
      { SERVICE_NAME: 'gateway-test' } as TGatewayBindings,
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'internal', message: 'Internal Server Error' },
    });
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

    const res = await fetchGateway(
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

  it('should not copy the public gateway port into the VPC request URL', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;
      return new Response(request.url);
    });

    const res = await fetchGateway(
      new Request('http://gateway.test:8787/crypto?currency=usd'),
      { TRADING_RPC: { fetch } as unknown as Fetcher },
    );

    expect(await res.text()).toBe(
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

    const res = await fetchGateway(
      rpcRequest(MARKETS_URL, { coinIds: ['bitcoin'], vsCurrency: 'usd' }),
      { TRADING_RPC: { fetch } as unknown as Fetcher },
    );

    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
    expect(res.headers.get('x-served-by')).toBe(
      'http://trading-rpc.internal/trading.v1.TradingService/GetMarkets',
    );
  });

  it('should return the same request ID that it forwards to trading RPC', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;
      return new Response('ok', {
        headers: {
          'x-upstream-request-id': request.headers.get('x-request-id') ?? '',
        },
      });
    });

    const res = await fetchGateway(
      rpcRequest(MARKETS_URL, { coinIds: ['bitcoin'], vsCurrency: 'usd' }),
      { TRADING_RPC: { fetch } as unknown as Fetcher },
    );

    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(res.headers.get('x-upstream-request-id')).toBe(
      res.headers.get('x-request-id'),
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

    const res = await fetchGateway(
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

    const res = await fetchGateway(
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

    const res = await fetchGateway(
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

    const res = await fetchGateway(
      new Request('http://gateway.test/does-not-exist'),
      { TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher },
    );

    expect(res.status).toBe(504);
  });

  it('should not proxy known/locally-handled routes when TRADING_RPC is bound', async () => {
    const fetchMock = vi.fn();

    const res = await fetchGateway(rpcRequest(HEALTH_URL, {}), {
      TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher,
    });

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should serve a gateway liveness endpoint that bypasses auth', async () => {
    const res = await fetchGateway(
      new Request('http://gateway.test/healthz'),
      { JWT_SECRET }, // auth enabled, but /healthz is public
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('should set an X-Request-Id header on every response', async () => {
    const res = await fetchGateway(
      new Request('http://gateway.test/healthz'),
      {},
    );

    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('should emit a readable access log without query values in development', async () => {
    const res = await fetchGateway(
      new Request('http://gateway.test/healthz?token=must-not-be-logged'),
      { ENVIRONMENT: 'development' },
    );

    expect(res.status).toBe(200);
    expect(console.info).toHaveBeenCalledOnce();
    const output = String(vi.mocked(console.info).mock.calls[0]?.[0]);
    expect(output).toMatch(
      /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO {2}\[gateway-test\] GET \/healthz 200 \d+(?:\.\d+)?ms requestId=.+$/,
    );
    expect(output).not.toContain('must-not-be-logged');
  });

  it('should emit structured access logs outside development', async () => {
    const res = await fetchGateway(new Request('http://gateway.test/healthz'), {
      ENVIRONMENT: 'production',
    });

    expect(res.status).toBe(200);
    expect(console.info).toHaveBeenCalledOnce();
    expect(
      JSON.parse(String(vi.mocked(console.info).mock.calls[0]?.[0])),
    ).toEqual(
      expect.objectContaining({
        service: 'gateway-test',
        level: 'info',
        event: 'request_completed',
        method: 'GET',
        pathname: '/healthz',
        requestId: expect.any(String),
        statusCode: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it('should keep market data public when auth is enabled', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    const res = await fetchGateway(
      rpcRequest(MARKETS_URL, { coinIds: ['bitcoin'], vsCurrency: 'usd' }),
      {
        JWT_SECRET,
        TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher,
      },
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('should allow a protected route with a valid bearer token', async () => {
    const token = await sign({ sub: 'user-1' }, JWT_SECRET);
    const fetchMock = vi.fn(async () => new Response('ok'));

    const res = await fetchGateway(rpcRequest(PROTECTED_URL, {}, token), {
      JWT_SECRET,
      TRADING_RPC: { fetch: fetchMock } as unknown as Fetcher,
    });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('should keep the Health route public even when auth is enabled', async () => {
    const res = await fetchGateway(rpcRequest(HEALTH_URL, {}), { JWT_SECRET });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ service: 'gateway-test' });
  });
});
