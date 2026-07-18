import type { GatewayRpcRequest } from '@/features/rpc-routing/application/gateway-rpc-endpoint.port';

/** Driving port for selecting the local or capability-owned RPC endpoint. */
export interface RouteRpcRequest<TRequest, TResponse> {
  execute(command: GatewayRpcRequest<TRequest>): Promise<TResponse>;
}
