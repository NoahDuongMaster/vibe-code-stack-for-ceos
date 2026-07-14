import { connect, constants } from 'node:http2';
import { Code, createClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcTransport,
} from '@connectrpc/connect-node';
import { ApiService, TradingService } from '@packages/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '@/adapters/http.adapter';
import { GetCryptoMarketsUseCase } from '@/application/get-crypto-markets/get-crypto-markets.use-case';
import { CoinId } from '@/domain/crypto-market/coin-id';
import { MarketDataUnavailableError } from '@/domain/crypto-market/errors';
import { MarketSnapshot } from '@/domain/crypto-market/market-snapshot';

/** Minimal h2c (cleartext HTTP/2) client for the non-RPC HTTP checks. */
function h2(
  baseUrl: string,
  opts: {
    path: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const session = connect(baseUrl);
    session.on('error', reject);
    const req = session.request({
      [constants.HTTP2_HEADER_METHOD]: opts.method ?? 'GET',
      [constants.HTTP2_HEADER_PATH]: opts.path,
      ...opts.headers,
    });
    let status = 0;
    let headers: Record<string, string | string[] | undefined> = {};
    const chunks: Buffer[] = [];
    req.on('response', (h) => {
      status = Number(h[constants.HTTP2_HEADER_STATUS]);
      headers = h;
    });
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      session.close();
      resolve({ status, headers, body: Buffer.concat(chunks).toString() });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

describe('createServer (Fastify / HTTP2)', () => {
  let app: Awaited<ReturnType<typeof createServer>> | undefined;
  let baseUrl = '';
  const marketDataProvider = {
    getMarkets: vi.fn(async () => [
      new MarketSnapshot({
        coinId: CoinId.create('bitcoin'),
        symbol: 'btc',
        name: 'Bitcoin',
        currentPrice: 70_000,
      }),
    ]),
  };
  const getCryptoMarkets = new GetCryptoMarketsUseCase(marketDataProvider);

  async function start(
    options?: Omit<Parameters<typeof createServer>[0], 'getCryptoMarkets'>,
  ) {
    app = await createServer({
      getCryptoMarkets,
      logger: false,
      ...options,
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  }

  function grpcClient() {
    return createClient(ApiService, createGrpcTransport({ baseUrl }));
  }

  function tradingClient() {
    return createClient(
      TradingService,
      createConnectTransport({ baseUrl, httpVersion: '1.1' }),
    );
  }

  afterEach(async () => {
    await app?.close();
    app = undefined;
    marketDataProvider.getMarkets.mockReset();
    marketDataProvider.getMarkets.mockResolvedValue([
      new MarketSnapshot({
        coinId: CoinId.create('bitcoin'),
        symbol: 'btc',
        name: 'Bitcoin',
        currentPrice: 70_000,
      }),
    ]);
  });

  it('should serve a valid Echo request over native gRPC', async () => {
    await start();
    const res = await grpcClient().echo({ message: 'node' });

    expect(res.upper).toBe('NODE');
    expect(res.length).toBe(4);
    expect(res.runtime).toBe('node');
  });

  it('should serve Health over native gRPC', async () => {
    await start();
    const res = await grpcClient().health({});

    expect(res.status).toBe('ok');
    expect(res.service).toBe('api-node');
    expect(res.runtime).toBe('node');
  });

  it('should serve a Connect Echo request over HTTP/1.1 when HTTP/2 is disabled', async () => {
    await start({ http2: false });
    const client = createClient(
      ApiService,
      createConnectTransport({ baseUrl, httpVersion: '1.1' }),
    );

    await expect(client.echo({ message: 'local' })).resolves.toMatchObject({
      upper: 'LOCAL',
      runtime: 'node',
    });
  });

  it('should serve current market data over TradingService', async () => {
    await start({ http2: false });

    await expect(
      tradingClient().getMarkets({
        coinIds: ['bitcoin'],
        vsCurrency: 'usd',
      }),
    ).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', currentPrice: 70_000 }],
      vsCurrency: 'usd',
    });
  });

  it('should reject a market request without coin IDs', async () => {
    await start({ http2: false });

    await expect(
      tradingClient().getMarkets({ coinIds: [], vsCurrency: 'usd' }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument });
  });

  it('should map an unavailable market provider to a Connect unavailable error', async () => {
    marketDataProvider.getMarkets.mockRejectedValueOnce(
      new MarketDataUnavailableError(),
    );
    await start({ http2: false });

    await expect(
      tradingClient().getMarkets({
        coinIds: ['bitcoin'],
        vsCurrency: 'usd',
      }),
    ).rejects.toMatchObject({ code: Code.Unavailable });
  });

  it('should return 200 on /healthz without touching the RPC handler', async () => {
    await start();
    const res = await h2(baseUrl, { path: '/healthz' });

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('should reject an oversized message (readMaxBytes)', async () => {
    await start({ maxBodyBytes: 32 });

    await expect(
      grpcClient().echo({ message: 'x'.repeat(1024) }),
    ).rejects.toThrow();
  });

  it('should rate-limit a client once it exceeds the configured max', async () => {
    await start({ rateLimit: 2, rateLimitWindowMs: 60_000 });
    const client = grpcClient();

    await client.echo({ message: 'a' });
    await client.echo({ message: 'b' });

    await expect(client.echo({ message: 'c' })).rejects.toThrow();
  });

  it('should never rate-limit /healthz', async () => {
    await start({ rateLimit: 1, rateLimitWindowMs: 60_000 });

    await h2(baseUrl, { path: '/healthz' });
    const res = await h2(baseUrl, { path: '/healthz' });

    expect(res.status).toBe(200);
  });

  it('should answer an allowed-origin CORS preflight with the origin echoed', async () => {
    await start({ corsOrigins: ['https://admin.example.com'] });

    const res = await h2(baseUrl, {
      path: '/api.v1.ApiService/Echo',
      method: 'OPTIONS',
      headers: {
        origin: 'https://admin.example.com',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.headers['access-control-allow-origin']).toBe(
      'https://admin.example.com',
    );
  });

  it('should not set CORS headers for a disallowed origin', async () => {
    await start({ corsOrigins: ['https://admin.example.com'] });

    const res = await h2(baseUrl, {
      path: '/api.v1.ApiService/Echo',
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil.example.com',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
