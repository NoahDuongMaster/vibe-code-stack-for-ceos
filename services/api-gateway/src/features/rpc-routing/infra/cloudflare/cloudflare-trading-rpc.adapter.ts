import type { GatewayRpcEndpoint } from '@/features/rpc-routing/application/gateway-rpc-endpoint.port';
import {
  type CloudflareRpcAdapterOptions,
  createCloudflareRpcAdapter,
} from '@/features/rpc-routing/infra/cloudflare/cloudflare-rpc.adapter';

export type CloudflareTradingRpcAdapterOptions = CloudflareRpcAdapterOptions;

/** Cloudflare/VPC driven adapter for the private trading RPC service. */
export const createCloudflareTradingRpcAdapter = (
  options: CloudflareTradingRpcAdapterOptions,
): GatewayRpcEndpoint<Request, Response> => createCloudflareRpcAdapter(options);
