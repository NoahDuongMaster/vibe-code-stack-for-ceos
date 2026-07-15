import { createFetchHandler } from '@packages/api-core';
import type {
  GatewayRpcEndpoint,
  GatewayRpcRequest,
} from '@/features/rpc-routing/application/gateway-rpc-endpoint.port';

/** Driven adapter hosting edge-owned Connect RPC methods in-process. */
export const createLocalApiCoreAdapter = (
  serviceName: string,
): GatewayRpcEndpoint<Request, Response> => {
  const localRpcHandler = createFetchHandler({
    serviceName,
    runtime: 'cloudflare-workers',
  });

  return {
    async handle(command: GatewayRpcRequest<Request>) {
      const response = await localRpcHandler(command.request);
      return { handled: response.status !== 404, response };
    },
  };
};
