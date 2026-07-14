import { createMiddleware } from 'hono/factory';
import type { TGatewayAppEnv } from '@/adapters/http/gateway-app-env';
import { parseGatewayRuntimeConfig } from '@/config/runtime-config';

/** Inbound adapter validating Cloudflare values before use cases are created. */
export const runtimeConfigMiddleware = createMiddleware<TGatewayAppEnv>(
  async (c, next) => {
    c.set('runtimeConfig', parseGatewayRuntimeConfig(c.env));
    await next();
  },
);
