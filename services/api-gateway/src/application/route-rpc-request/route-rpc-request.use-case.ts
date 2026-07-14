import type {
  GatewayRpcEndpoint,
  GatewayRpcRequest,
} from '@/application/route-rpc-request/gateway-rpc-endpoint.port';
import type { RouteRpcRequest } from '@/application/route-rpc-request/route-rpc-request.port';

/** Application service keeping edge-owned RPCs local and delegating misses. */
export class RouteRpcRequestUseCase<TRequest, TResponse>
  implements RouteRpcRequest<TRequest, TResponse>
{
  constructor(
    private readonly localEndpoint: GatewayRpcEndpoint<TRequest, TResponse>,
    private readonly tradingEndpoint:
      | GatewayRpcEndpoint<TRequest, TResponse>
      | undefined,
  ) {}

  async execute(command: GatewayRpcRequest<TRequest>): Promise<TResponse> {
    const localResult = await this.localEndpoint.handle(command);
    if (localResult.handled || !this.tradingEndpoint) {
      return localResult.response;
    }

    return (await this.tradingEndpoint.handle(command)).response;
  }
}
