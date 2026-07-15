import type {
  GatewayRpcEndpoint,
  GatewayRpcRequest,
} from '@/features/rpc-routing/application/gateway-rpc-endpoint.port';
import type { RouteRpcRequest } from '@/features/rpc-routing/application/route-rpc-request.port';

/** Application service keeping edge-owned RPCs local and delegating misses. */
export class RouteRpcRequestUseCase<TRequest, TResponse>
  implements RouteRpcRequest<TRequest, TResponse>
{
  constructor(
    private readonly localEndpoint: GatewayRpcEndpoint<TRequest, TResponse>,
    private readonly tradingEndpoint: GatewayRpcEndpoint<TRequest, TResponse>,
  ) {}

  async execute(command: GatewayRpcRequest<TRequest>): Promise<TResponse> {
    const localResult = await this.localEndpoint.handle(command);
    if (localResult.handled) {
      return localResult.response;
    }

    return (await this.tradingEndpoint.handle(command)).response;
  }
}
