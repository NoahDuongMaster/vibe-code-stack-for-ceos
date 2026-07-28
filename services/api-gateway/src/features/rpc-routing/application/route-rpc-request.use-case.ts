import type {
  GatewayRpcEndpoint,
  GatewayRpcRequest,
} from '@/features/rpc-routing/application/gateway-rpc-endpoint.port';
import type { RouteRpcRequest } from '@/features/rpc-routing/application/route-rpc-request.port';
import { UpstreamUnavailableError } from '@/features/rpc-routing/domain/errors';

const ADMIN_RPC_PATH_PREFIXES = [
  '/admin.v1.AdminService/',
  '/auth.v1.AuthService/',
] as const;

/** Application service keeping edge-owned RPCs local and delegating misses. */
export class RouteRpcRequestUseCase<TRequest, TResponse>
  implements RouteRpcRequest<TRequest, TResponse>
{
  constructor(
    private readonly localEndpoint: GatewayRpcEndpoint<TRequest, TResponse>,
    private readonly tradingEndpoint: GatewayRpcEndpoint<TRequest, TResponse>,
    private readonly adminEndpoint?: GatewayRpcEndpoint<TRequest, TResponse>,
  ) {}

  async execute(command: GatewayRpcRequest<TRequest>): Promise<TResponse> {
    const localResult = await this.localEndpoint.handle(command);
    if (localResult.handled) {
      return localResult.response;
    }

    if (
      ADMIN_RPC_PATH_PREFIXES.some((prefix) =>
        command.rpcPath.startsWith(prefix),
      )
    ) {
      if (!this.adminEndpoint) throw new UpstreamUnavailableError();
      return (await this.adminEndpoint.handle(command)).response;
    }

    return (await this.tradingEndpoint.handle(command)).response;
  }
}
