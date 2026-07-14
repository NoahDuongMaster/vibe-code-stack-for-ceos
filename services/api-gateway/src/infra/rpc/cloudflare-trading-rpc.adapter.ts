import type {
  GatewayRpcEndpoint,
  GatewayRpcRequest,
} from '@/application/route-rpc-request/gateway-rpc-endpoint.port';
import {
  UpstreamTimeoutError,
  UpstreamUnavailableError,
} from '@/domain/routing/errors';

interface ProxyTarget {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CloudflareTradingRpcAdapterOptions {
  origin: string;
  target: ProxyTarget;
  timeoutMs: number;
}

const withoutCorsHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  for (const key of [...headers.keys()]) {
    if (key.startsWith('access-control-')) headers.delete(key);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/** Cloudflare/VPC driven adapter for the private trading RPC service. */
export const createCloudflareTradingRpcAdapter = (
  options: CloudflareTradingRpcAdapterOptions,
): GatewayRpcEndpoint<Request, Response> => ({
  async handle(command: GatewayRpcRequest<Request>) {
    const requestUrl = new URL(command.request.url);
    const targetUrl = new URL(options.origin);
    requestUrl.protocol = targetUrl.protocol;
    requestUrl.host = targetUrl.host;

    const request = new Request(requestUrl, command.request);
    request.headers.set('x-request-id', command.requestId);

    try {
      const response = await options.target.fetch(request, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      return { handled: true, response: withoutCorsHeaders(response) };
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new UpstreamTimeoutError();
      }
      throw new UpstreamUnavailableError();
    }
  },
});
