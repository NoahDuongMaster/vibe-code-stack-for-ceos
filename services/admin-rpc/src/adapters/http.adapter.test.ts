import { createServer as createTcpServer } from 'node:net';
import { createClient } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcTransport,
} from '@connectrpc/connect-node';
import { AdminService, HealthService } from '@packages/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '@/adapters/http.adapter';

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

describe('createServer (admin-rpc)', () => {
  let app: Awaited<ReturnType<typeof createServer>> | undefined;
  const tradingMarketData = {
    getMarkets: vi.fn(async () => ({
      markets: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }],
      vsCurrency: 'usd',
    })),
  };

  afterEach(async () => {
    await app?.close();
    app = undefined;
    tradingMarketData.getMarkets.mockClear();
  });

  it('should expose AdminService over Connect and delegate to trading-rpc', async () => {
    app = await createServer({
      serviceName: 'admin-rpc-test',
      tradingMarketData,
      http2: false,
      enableGrpc: false,
      enableShutdownHooks: false,
      logger: false,
    });
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const client = createClient(
      AdminService,
      createConnectTransport({
        baseUrl: `http://127.0.0.1:${port}`,
        httpVersion: '1.1',
      }),
    );

    await expect(
      client.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', name: 'Bitcoin' }],
      vsCurrency: 'usd',
    });
    expect(tradingMarketData.getMarkets).toHaveBeenCalledOnce();
  });

  it('should expose the configured identity over native gRPC', async () => {
    const grpcPort = await reservePort();
    app = await createServer({
      serviceName: 'admin-rpc-test',
      tradingMarketData,
      http2: false,
      grpcUrl: `127.0.0.1:${grpcPort}`,
      enableShutdownHooks: false,
      logger: false,
    });
    await app.init();
    await app.startAllMicroservices();

    const client = createClient(
      HealthService,
      createGrpcTransport({ baseUrl: `http://127.0.0.1:${grpcPort}` }),
    );
    await expect(client.health({})).resolves.toMatchObject({
      status: 'ok',
      service: 'admin-rpc-test',
      runtime: 'node',
    });

    const adminClient = createClient(
      AdminService,
      createGrpcTransport({ baseUrl: `http://127.0.0.1:${grpcPort}` }),
    );
    await expect(
      adminClient.getMarkets({ coinIds: ['bitcoin'], vsCurrency: 'usd' }),
    ).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', name: 'Bitcoin' }],
      vsCurrency: 'usd',
    });
  });
});
