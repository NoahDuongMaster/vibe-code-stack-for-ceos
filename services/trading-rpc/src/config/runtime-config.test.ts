import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '@/config/runtime-config';

describe('parseRuntimeConfig', () => {
  it('should provide development-safe defaults for omitted optional values', () => {
    expect(parseRuntimeConfig({ NODE_ENV: 'development' })).toMatchObject({
      nodeEnv: 'development',
      port: 3001,
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
        PORT: '4000',
        RPC_TRANSPORT: 'http2',
        CORS_ORIGINS: ' https://dapp.example.com, ,https://admin.example.com ',
        COINGECKO_API_KEY: ' demo-key ',
      }),
    ).toMatchObject({
      port: 4000,
      rpcTransport: 'http2',
      corsOrigins: ['https://dapp.example.com', 'https://admin.example.com'],
      coingeckoApiKey: 'demo-key',
    });
  });

  it('should reject a non-positive numeric runtime value', () => {
    expect(() => parseRuntimeConfig({ PORT: '-1' })).toThrow(/PORT/);
  });

  it('should reject an unsupported transport override', () => {
    expect(() => parseRuntimeConfig({ RPC_TRANSPORT: 'h3' })).toThrow(
      /RPC_TRANSPORT/,
    );
  });
});
