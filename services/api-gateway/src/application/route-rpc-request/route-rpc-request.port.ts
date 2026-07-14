import type { GatewayRpcRequest } from '@/application/route-rpc-request/gateway-rpc-endpoint.port';

/** Driving port for selecting the local or trading RPC endpoint. */
export interface RouteRpcRequest<TRequest, TResponse> {
  execute(command: GatewayRpcRequest<TRequest>): Promise<TResponse>;
}
