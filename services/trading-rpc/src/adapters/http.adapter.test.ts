import { connect, constants } from 'node:http2';
import { createServer as createTcpServer } from 'node:net';
import { Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { Code, createClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcTransport,
} from '@connectrpc/connect-node';
import { HealthService, TradingService } from '@packages/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '@/adapters/http.adapter';
import { CoinId } from '@/features/market-data/domain/coin-id';
import { MarketDataUnavailableError } from '@/features/market-data/domain/errors';
import { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';

interface TLogEvent {
  [key: string]: unknown;
  msg?: string;
}

const createTestGrpcTransport = (baseUrl: string) =>
  createGrpcTransport({ baseUrl, idleConnectionTimeoutMs: 1 });

function captureJsonLogs(): {
  events: TLogEvent[];
  stream: Writable;
} {
  const events: TLogEvent[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).trim().split('\n')) {
        if (line) events.push(JSON.parse(line) as TLogEvent);
      }
      callback();
    },
  });
  return { events, stream };
}

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

async function reservePort(): Promise<number> {
  const socket = createTcpServer();
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const address = socket.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => {
    socket.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

describe('createServer (Nest / Fastify / Connect / gRPC)', () => {
  const serviceName = 'trading-rpc-test';
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
  const marketSnapshotRepository = {
    onApplicationBootstrap: vi.fn(async () => undefined),
    onApplicationShutdown: vi.fn(async () => undefined),
    saveLatest: vi.fn(async () => undefined),
  };
  async function start(
    options?: Omit<
      Parameters<typeof createServer>[0],
      'marketDataProvider' | 'marketSnapshotRepository' | 'serviceName'
    >,
  ) {
    app = await createServer({
      serviceName,
      marketDataProvider,
      marketSnapshotRepository,
      logger: false,
      enableGrpc: options?.grpcUrl !== undefined,
      enableShutdownHooks: false,
      ...options,
    });
    await app.init();
    await app.startAllMicroservices();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  }

  function grpcClient(rpcBaseUrl = baseUrl) {
    return createClient(HealthService, createTestGrpcTransport(rpcBaseUrl));
  }

  function tradingClient() {
    return createClient(
      TradingService,
      createConnectTransport({ baseUrl, httpVersion: '1.1' }),
    );
  }

  function tradingJson(input: Record<string, unknown>): Promise<Response> {
    return fetch(`${baseUrl}/trading.v1.TradingService/GetMarkets`, {
      method: 'POST',
      headers: {
        'Connect-Protocol-Version': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  }

  afterEach(async () => {
    // Connect's Node HTTP/2 transport pools sessions. Give the test transport's
    // 1 ms idle timeout a chance to close them before Fastify begins graceful
    // shutdown, otherwise a rejected RPC can keep app.close() waiting.
    await delay(5);
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
    marketSnapshotRepository.saveLatest.mockReset();
    marketSnapshotRepository.saveLatest.mockResolvedValue(undefined);
    marketSnapshotRepository.onApplicationBootstrap.mockReset();
    marketSnapshotRepository.onApplicationBootstrap.mockResolvedValue(
      undefined,
    );
    marketSnapshotRepository.onApplicationShutdown.mockReset();
    marketSnapshotRepository.onApplicationShutdown.mockResolvedValue(undefined);
  });

  it('should host Fastify through a Nest application', async () => {
    await start({ http2: false });

    expect(
      typeof (app as unknown as { getHttpAdapter?: unknown }).getHttpAdapter,
    ).toBe('function');
  });

  it('should run the persistence adapter through Nest bootstrap lifecycle', async () => {
    await start({ http2: false });

    expect(
      marketSnapshotRepository.onApplicationBootstrap,
    ).toHaveBeenCalledOnce();
  });

  it('should serve Health over native gRPC', async () => {
    const grpcPort = await reservePort();
    const grpcBaseUrl = `http://127.0.0.1:${grpcPort}`;
    await start({ http2: false, grpcUrl: `127.0.0.1:${grpcPort}` });
    const res = await grpcClient(grpcBaseUrl).health({});

    expect(res.status).toBe('ok');
    expect(res.service).toBe(serviceName);
    expect(res.runtime).toBe('node');
  });

  it('should serve the configured service name over Connect', async () => {
    await start({ http2: false });
    const client = createClient(
      HealthService,
      createConnectTransport({ baseUrl, httpVersion: '1.1' }),
    );

    await expect(client.health({})).resolves.toMatchObject({
      service: serviceName,
      runtime: 'node',
    });
  });

  it('should enrich completed Connect access logs without logging payloads', async () => {
    const logs = captureJsonLogs();
    await start({ http2: false, logger: { stream: logs.stream } });

    const response = await fetch(`${baseUrl}/health.v1.HealthService/Health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'gateway-request-123',
      },
      body: '{}',
    });

    expect(response.status).toBe(200);
    const completed = logs.events.find(
      (event) => event.msg === 'request completed',
    );
    expect(completed).toMatchObject({
      reqId: 'gateway-request-123',
      serviceName,
      runtime: 'node',
      protocol: 'connect',
      rpcService: 'health.v1.HealthService',
      rpcMethod: 'Health',
      res: { statusCode: 200 },
    });
    expect(completed).not.toHaveProperty('body');
    expect(completed).not.toHaveProperty('responseBody');
  });

  it('should identify plain HTTP operations in completed access logs', async () => {
    const logs = captureJsonLogs();
    await start({ http2: false, logger: { stream: logs.stream } });

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    const completed = logs.events.find(
      (event) => event.msg === 'request completed',
    );
    expect(completed).toMatchObject({
      serviceName,
      runtime: 'node',
      protocol: 'http',
      httpMethod: 'GET',
      httpPath: '/healthz',
      res: { statusCode: 200 },
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
    expect(marketSnapshotRepository.saveLatest).toHaveBeenCalledOnce();
  });

  it('should expose lowerCamelCase as the canonical Connect JSON contract', async () => {
    await start({ http2: false });

    const response = await tradingJson({
      coinIds: ['bitcoin'],
      vsCurrency: 'usd',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      markets: [{ id: 'bitcoin', currentPrice: 70_000 }],
      vsCurrency: 'usd',
    });
    expect(body).not.toHaveProperty('vs_currency');
    expect(body.markets).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ current_price: 70_000 }),
      ]),
    );
  });

  it('should accept original proto snake_case names for ProtoJSON compatibility', async () => {
    await start({ http2: false });

    const response = await tradingJson({
      coin_ids: ['bitcoin'],
      vs_currency: 'usd',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', currentPrice: 70_000 }],
      vsCurrency: 'usd',
    });
  });

  it('should return the standard Connect error object without a success envelope', async () => {
    await start({ http2: false });

    const response = await tradingJson({ coinIds: [], vsCurrency: 'usd' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'invalid_argument',
      message: 'Invalid market request',
    });
  });

  it('should expose TradingService through the native Nest gRPC listener', async () => {
    const grpcPort = await reservePort();
    await start({
      http2: false,
      grpcUrl: `127.0.0.1:${grpcPort}`,
    });
    const client = createClient(
      TradingService,
      createTestGrpcTransport(`http://127.0.0.1:${grpcPort}`),
    );

    await expect(
      client.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', currentPrice: 70_000 }],
      vsCurrency: 'usd',
    });
  });

  it('should reject invalid market input through the Nest gRPC pipe', async () => {
    const grpcPort = await reservePort();
    await start({
      http2: false,
      grpcUrl: `127.0.0.1:${grpcPort}`,
    });
    const client = createClient(
      TradingService,
      createTestGrpcTransport(`http://127.0.0.1:${grpcPort}`),
    );

    await expect(
      client.getMarkets({ coinIds: [], vsCurrency: 'usd' }),
    ).rejects.toMatchObject({
      code: Code.InvalidArgument,
      rawMessage: 'Invalid market request',
    });
  });

  it('should map provider failures through the Nest gRPC exception filter', async () => {
    marketDataProvider.getMarkets.mockRejectedValueOnce(
      new MarketDataUnavailableError(),
    );
    const grpcPort = await reservePort();
    await start({
      http2: false,
      grpcUrl: `127.0.0.1:${grpcPort}`,
    });
    const client = createClient(
      TradingService,
      createTestGrpcTransport(`http://127.0.0.1:${grpcPort}`),
    );

    await expect(
      client.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).rejects.toMatchObject({ code: Code.Unavailable });
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
    const client = createClient(
      TradingService,
      createTestGrpcTransport(baseUrl),
    );

    await expect(
      client.getMarkets({ coinIds: ['x'.repeat(1024)], vsCurrency: 'usd' }),
    ).rejects.toThrow();
  });

  it('should rate-limit a client once it exceeds the configured max', async () => {
    await start({ rateLimit: 2, rateLimitWindowMs: 60_000 });
    const client = createClient(
      TradingService,
      createTestGrpcTransport(baseUrl),
    );
    const request = { coinIds: ['bitcoin'], vsCurrency: 'usd' };

    await client.getMarkets(request);
    await client.getMarkets(request);

    await expect(client.getMarkets(request)).rejects.toThrow();
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
      path: '/health.v1.HealthService/Health',
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
      path: '/health.v1.HealthService/Health',
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil.example.com',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
