import { createFetchHandler } from '@packages/api-core';
import type {
  GatewayRpcEndpoint,
  GatewayRpcRequest,
} from '@/application/route-rpc-request/gateway-rpc-endpoint.port';

const localRpcHandler = createFetchHandler({
  serviceName: 'gateway',
  runtime: 'cloudflare-workers',
});

/** Driven adapter hosting edge-owned Connect RPC methods in-process. */
export const localApiCoreAdapter: GatewayRpcEndpoint<Request, Response> = {
  async handle(command: GatewayRpcRequest<Request>) {
    const response = await localRpcHandler(command.request);
    return { handled: response.status !== 404, response };
  },
};
