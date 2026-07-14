import type { TGatewayBindings } from '@/adapters/cloudflare/gateway-bindings';
import type { GatewayRequestScope } from '@/application/gateway-request-scope';
import type { TGatewayRuntimeConfig } from '@/config/runtime-config';

export interface TGatewayVariables {
  requestId: string;
  runtimeConfig: TGatewayRuntimeConfig;
  requestScope: GatewayRequestScope<Request, Response>;
}

export type TGatewayAppEnv = {
  Bindings: TGatewayBindings;
  Variables: TGatewayVariables;
};
