import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '@/config/runtime-config';

describe('parseRuntimeConfig', () => {
  it('should provide bounded defaults for optional values', () => {
    expect(
      parseRuntimeConfig({
        SERVICE_NAME: ' admin-rpc ',
        TRADING_RPC_GRPC_URL: 'http://127.0.0.1:50051/',
      }),
    ).toMatchObject({
      serviceName: 'admin-rpc',
      nodeEnv: 'development',
      port: 3004,
      grpcPort: 50053,
      tradingRpcGrpcUrl: 'http://127.0.0.1:50051',
      tradingRpcTimeoutMs: 5_000,
      rpcTransport: 'http1',
      corsOrigins: [],
    });
  });

  it('should normalize injected runtime values', () => {
    expect(
      parseRuntimeConfig({
        SERVICE_NAME: 'admin-rpc',
        TRADING_RPC_GRPC_URL: 'https://trading-rpc.internal:50051',
        TRADING_RPC_TIMEOUT_MS: '2500',
        PORT: '4004',
        GRPC_PORT: '50054',
        CORS_ORIGINS: ' https://admin.example.com, https://admin.example.com ',
        RPC_TRANSPORT: 'http2',
      }),
    ).toMatchObject({
      tradingRpcTimeoutMs: 2_500,
      port: 4004,
      grpcPort: 50054,
      corsOrigins: ['https://admin.example.com'],
      rpcTransport: 'http2',
    });
  });

  it('should reject missing service identity or trading-rpc endpoint', () => {
    expect(() =>
      parseRuntimeConfig({
        TRADING_RPC_GRPC_URL: 'http://127.0.0.1:50051',
      }),
    ).toThrow(/SERVICE_NAME/);
    expect(() => parseRuntimeConfig({ SERVICE_NAME: 'admin-rpc' })).toThrow(
      /TRADING_RPC_GRPC_URL/,
    );
  });

  it('should reject non-HTTP downstream URLs and non-positive timeouts', () => {
    expect(() =>
      parseRuntimeConfig({
        SERVICE_NAME: 'admin-rpc',
        TRADING_RPC_GRPC_URL: 'ftp://trading-rpc.internal',
      }),
    ).toThrow(/TRADING_RPC_GRPC_URL/);
    expect(() =>
      parseRuntimeConfig({
        SERVICE_NAME: 'admin-rpc',
        TRADING_RPC_GRPC_URL: 'http://127.0.0.1:50051',
        TRADING_RPC_TIMEOUT_MS: '0',
      }),
    ).toThrow(/TRADING_RPC_TIMEOUT_MS/);
  });

  it('should reject downstream URLs that could leak credentials or alter RPC paths', () => {
    for (const tradingRpcGrpcUrl of [
      'http://user:password@trading-rpc.internal:50051',
      'http://trading-rpc.internal:50051/private',
      'http://trading-rpc.internal:50051?token=secret',
    ]) {
      expect(() =>
        parseRuntimeConfig({
          SERVICE_NAME: 'admin-rpc',
          TRADING_RPC_GRPC_URL: tradingRpcGrpcUrl,
        }),
      ).toThrow(/TRADING_RPC_GRPC_URL/);
    }
  });
});
