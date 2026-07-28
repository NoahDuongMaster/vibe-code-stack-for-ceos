import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '@/config/runtime-config';

describe('parseRuntimeConfig', () => {
  const databaseUrl =
    'postgresql://trading_rpc:secret@localhost:5432/trading_rpc';

  it('should provide development-safe defaults for omitted optional values', () => {
    expect(
      parseRuntimeConfig({
        SERVICE_NAME: ' trading-rpc ',
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'development',
      }),
    ).toMatchObject({
      serviceName: 'trading-rpc',
      databaseUrl,
      databasePoolMax: 10,
      databaseConnectionTimeoutMs: 5_000,
      databaseIdleTimeoutMs: 30_000,
      nodeEnv: 'development',
      port: 46_004,
      grpcPort: 46_005,
      rpcTransport: 'http1',
      corsOrigins: [],
      maxBodyBytes: 5 * 1024 * 1024,
      requestTimeoutMs: 30_000,
      rateLimit: 300,
      rateLimitWindowMs: 60_000,
    });
  });

  it('should normalize injected settings before the composition root uses them', () => {
    expect(
      parseRuntimeConfig({
        SERVICE_NAME: 'trading-rpc',
        DATABASE_URL: ` ${databaseUrl} `,
        PORT: '4000',
        GRPC_PORT: '50052',
        RPC_TRANSPORT: 'http2',
        CORS_ORIGINS: ' https://dapp.example.com, ,https://admin.example.com ',
        COINGECKO_API_KEY: ' demo-key ',
        DATABASE_POOL_MAX: '20',
        DATABASE_CONNECTION_TIMEOUT_MS: '6000',
        DATABASE_IDLE_TIMEOUT_MS: '40000',
      }),
    ).toMatchObject({
      port: 4000,
      grpcPort: 50052,
      rpcTransport: 'http2',
      corsOrigins: ['https://dapp.example.com', 'https://admin.example.com'],
      coingeckoApiKey: 'demo-key',
      databaseUrl,
      databasePoolMax: 20,
      databaseConnectionTimeoutMs: 6_000,
      databaseIdleTimeoutMs: 40_000,
    });
  });

  it('should reject a non-positive numeric runtime value', () => {
    expect(() =>
      parseRuntimeConfig({
        SERVICE_NAME: 'trading-rpc',
        DATABASE_URL: databaseUrl,
        PORT: '-1',
      }),
    ).toThrow(/PORT/);
  });

  it('should reject an unsupported transport override', () => {
    expect(() =>
      parseRuntimeConfig({
        SERVICE_NAME: 'trading-rpc',
        DATABASE_URL: databaseUrl,
        RPC_TRANSPORT: 'h3',
      }),
    ).toThrow(/RPC_TRANSPORT/);
  });

  it('should reject a missing service name', () => {
    expect(() =>
      parseRuntimeConfig({
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'development',
      }),
    ).toThrow(/SERVICE_NAME/);
  });

  it('should reject a whitespace-only service name', () => {
    expect(() =>
      parseRuntimeConfig({ SERVICE_NAME: '   ', DATABASE_URL: databaseUrl }),
    ).toThrow(/SERVICE_NAME/);
  });

  it('should reject a missing PostgreSQL connection URL', () => {
    expect(() => parseRuntimeConfig({ SERVICE_NAME: 'trading-rpc' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
