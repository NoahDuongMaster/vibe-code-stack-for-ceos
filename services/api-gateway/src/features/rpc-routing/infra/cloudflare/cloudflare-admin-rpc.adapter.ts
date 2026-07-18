import type { GatewayRpcEndpoint } from '@/features/rpc-routing/application/gateway-rpc-endpoint.port';
import {
  type CloudflareRpcAdapterOptions,
  createCloudflareRpcAdapter,
} from '@/features/rpc-routing/infra/cloudflare/cloudflare-rpc.adapter';

export type CloudflareAdminRpcAdapterOptions = CloudflareRpcAdapterOptions;

/** Cloudflare/VPC driven adapter for the private admin RPC service. */
export const createCloudflareAdminRpcAdapter = (
  options: CloudflareAdminRpcAdapterOptions,
): GatewayRpcEndpoint<Request, Response> => createCloudflareRpcAdapter(options);
