import { describe, expect, it } from 'vitest';
import type { TGatewayRuntimeBindingValues } from '@/config/runtime-config';
import { parseGatewayRuntimeConfig } from '@/config/runtime-config';

describe('[parseGatewayRuntimeConfig]', () => {
  it('should normalize development configuration', () => {
    const config = parseGatewayRuntimeConfig({
      SERVICE_NAME: ' edge-gateway ',
      ENVIRONMENT: 'development',
      CORS_ORIGINS:
        'https://admin.example.com, https://dapp.example.com, https://admin.example.com',
    });

    expect(config).toEqual({
      serviceName: 'edge-gateway',
      environment: 'development',
      corsOrigins: ['https://admin.example.com', 'https://dapp.example.com'],
      jwtSecret: undefined,
    });
  });

  it('should reject a missing service name', () => {
    expect(() =>
      parseGatewayRuntimeConfig({} as TGatewayRuntimeBindingValues),
    ).toThrow(/SERVICE_NAME/);
  });

  it('should reject a whitespace-only service name', () => {
    expect(() => parseGatewayRuntimeConfig({ SERVICE_NAME: '   ' })).toThrow(
      /SERVICE_NAME/,
    );
  });
});
