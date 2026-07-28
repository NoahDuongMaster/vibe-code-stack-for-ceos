import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAdminClient,
  createApiClient,
  createAuthClient,
  createTradingClient,
} from './index';

const HEALTH_URL = 'http://localhost:46004/health.v1.HealthService/Health';
const MARKETS_URL =
  'http://localhost:46003/trading.v1.TradingService/GetMarkets';
const ADMIN_MARKETS_URL =
  'http://localhost:46003/admin.v1.AdminService/GetMarkets';
const LOGIN_URL = 'http://localhost:46003/auth.v1.AuthService/Login';

describe('createApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should build a client exposing the HealthService method', () => {
    const client = createApiClient('http://localhost:46004');

    expect(client).not.toHaveProperty('echo');
    expect(client.health).toBeTypeOf('function');
  });

  it('should build a client exposing TradingService methods independently', () => {
    const client = createTradingClient('http://localhost:46003');

    expect(client.getMarkets).toBeTypeOf('function');
  });

  it('should build a client exposing the admin market facade', () => {
    const client = createAdminClient('http://localhost:46003');

    expect(client.getMarkets).toBeTypeOf('function');
  });

  it('should authenticate through the gateway and return a typed session', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(LOGIN_URL);
      return new Response(
        JSON.stringify({
          token: 'signed-jwt',
          user: {
            id: 'admin:admin@example.com',
            email: 'admin@example.com',
            name: 'Administrator',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await createAuthClient('http://localhost:46003').login({
      email: 'admin@example.com',
      password: 'local-admin-password',
    });

    expect(response).toMatchObject({
      token: 'signed-jwt',
      user: { email: 'admin@example.com' },
    });
  });

  it('should POST admin market requests to the gateway', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(ADMIN_MARKETS_URL);
      return new Response(
        JSON.stringify({
          markets: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }],
          vsCurrency: 'usd',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await createAdminClient('http://localhost:46003').getMarkets({
      coinIds: ['bitcoin'],
      vsCurrency: 'usd',
    });

    expect(res).toMatchObject({
      markets: [{ id: 'bitcoin', symbol: 'btc' }],
      vsCurrency: 'usd',
    });
  });

  it('should POST market requests to the gateway', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(MARKETS_URL);
      return new Response(
        JSON.stringify({
          markets: [
            {
              id: 'bitcoin',
              symbol: 'btc',
              name: 'Bitcoin',
              currentPrice: 70_000,
            },
          ],
          vsCurrency: 'usd',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await createTradingClient('http://localhost:46003').getMarkets({
      coinIds: ['bitcoin'],
      vsCurrency: 'usd',
    });

    expect(res).toMatchObject({
      markets: [{ id: 'bitcoin', currentPrice: 70_000 }],
      vsCurrency: 'usd',
    });
  });

  it('should POST health requests and return the typed response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(HEALTH_URL);
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'trading-rpc',
          runtime: 'node',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient('http://localhost:46004');
    const res = await client.health({});

    expect(res).toMatchObject({
      status: 'ok',
      service: 'trading-rpc',
      runtime: 'node',
    });
  });

  it('should reject when the server returns a Connect error response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'internal', message: 'boom' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient('http://localhost:46004');

    await expect(client.health({})).rejects.toThrow();
  });

  it('should forward extra transport options (e.g. custom headers via interceptors)', async () => {
    let seenHeaders: Headers | undefined;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = new Headers(init?.headers);
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'trading-rpc',
            runtime: 'test',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient('http://localhost:46004', {
      interceptors: [
        (next) => (req) => {
          req.header.set('x-custom', 'yes');
          return next(req);
        },
      ],
    });
    await client.health({});

    expect(seenHeaders?.get('x-custom')).toBe('yes');
  });
});
