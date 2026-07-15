import type { TGatewayBindings } from '@/adapters/cloudflare/gateway-bindings';
import type { GatewayRequestScope } from '@/adapters/http/gateway-request-scope';
import type { TGatewayRuntimeConfig } from '@/config/runtime-config';

export type GatewayRequestScopeFactory = (
  bindings: TGatewayBindings,
  config: TGatewayRuntimeConfig,
) => GatewayRequestScope<Request, Response>;
