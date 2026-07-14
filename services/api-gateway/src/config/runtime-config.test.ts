import { describe, expect, it } from 'vitest';
import { parseGatewayRuntimeConfig } from '@/config/runtime-config';

describe('[parseGatewayRuntimeConfig]', () => {
  it('should normalize development config and expose a safe local upstream origin', () => {
    const config = parseGatewayRuntimeConfig({
      ENVIRONMENT: 'development',
      CORS_ORIGINS:
        'https://admin.example.com, https://dapp.example.com, https://admin.example.com',
      LOCAL_TRADING_RPC_URL: 'http://127.0.0.1:3001',
    });

    expect(config).toEqual({
      environment: 'development',
      corsOrigins: ['https://admin.example.com', 'https://dapp.example.com'],
      jwtSecret: undefined,
      localTradingRpcOrigin: 'http://127.0.0.1:3001',
    });
  });

  it('should ignore a local upstream outside development', () => {
    const config = parseGatewayRuntimeConfig({
      ENVIRONMENT: 'production',
      LOCAL_TRADING_RPC_URL: 'ftp://127.0.0.1:3001',
    });

    expect(config.localTradingRpcOrigin).toBeUndefined();
  });

  it('should reject a development local upstream with a non-http protocol', () => {
    expect(() =>
      parseGatewayRuntimeConfig({
        ENVIRONMENT: 'development',
        LOCAL_TRADING_RPC_URL: 'ftp://127.0.0.1:3001',
      }),
    ).toThrow('LOCAL_TRADING_RPC_URL');
  });
});
