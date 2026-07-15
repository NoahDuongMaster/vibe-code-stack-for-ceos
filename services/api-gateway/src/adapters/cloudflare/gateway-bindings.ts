import type { TGatewayRuntimeBindingValues } from '@/config/runtime-config';
import type { RateLimiterDO } from '@/features/rate-limiting';

/** Cloudflare bindings used only by outer adapters and the composition root. */
export interface TGatewayBindings extends TGatewayRuntimeBindingValues {
  TRADING_RPC: Fetcher;
  RATE_LIMITER?: DurableObjectNamespace<RateLimiterDO>;
}
