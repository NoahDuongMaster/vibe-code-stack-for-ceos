import { createGatewayDeployConfig } from '@scripts/create-deploy-config';
import { describe, expect, it } from 'vitest';

const source = `{
  // JSONC comments and trailing commas are intentional.
  "name": "gateway",
  "main": "./src/index.ts",
  "env": {
    "staging": {
      "vars": { "SERVICE_NAME": "api-gateway", "CORS_ORIGINS": "" },
    },
    "production": {
      "vars": { "SERVICE_NAME": "api-gateway", "CORS_ORIGINS": "" },
    },
  },
}`;

const inputs = {
  GATEWAY_CORS_ORIGINS:
    'https://admin.example.com, https://app.example.com,https://admin.example.com',
  TRADING_RPC_VPC_SERVICE_ID: '019f63fc-a6ec-7603-8cf9-799d6581303c',
  ADMIN_RPC_VPC_SERVICE_ID: '019f74b3-a15d-7322-b1f5-8781309b5f37',
};

describe('[createGatewayDeployConfig]', () => {
  it('should inject validated environment-specific CORS and VPC bindings', () => {
    const config = createGatewayDeployConfig(source, 'staging', inputs);
    const staging = (config.env as Record<string, Record<string, unknown>>)
      .staging;

    expect(staging).toMatchObject({
      vars: {
        SERVICE_NAME: 'api-gateway',
        CORS_ORIGINS: 'https://admin.example.com,https://app.example.com',
      },
      vpc_services: [
        {
          binding: 'TRADING_RPC',
          service_id: inputs.TRADING_RPC_VPC_SERVICE_ID,
        },
        { binding: 'ADMIN_RPC', service_id: inputs.ADMIN_RPC_VPC_SERVICE_ID },
      ],
    });
  });

  it('should reject placeholders, wildcards, and malformed service IDs', () => {
    expect(() =>
      createGatewayDeployConfig(source, 'production', {
        ...inputs,
        GATEWAY_CORS_ORIGINS: '*',
      }),
    ).toThrow(/allow-list/);
    expect(() =>
      createGatewayDeployConfig(source, 'production', {
        ...inputs,
        ADMIN_RPC_VPC_SERVICE_ID: 'replace-me',
      }),
    ).toThrow();
  });
});
