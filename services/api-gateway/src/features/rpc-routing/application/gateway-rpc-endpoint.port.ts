export interface GatewayRpcRequest<TRequest> {
  request: TRequest;
  requestId: string;
}

export interface GatewayRpcEndpointResult<TResponse> {
  handled: boolean;
  response: TResponse;
}

/** Driven port for either a local RPC runtime or a remote trading endpoint. */
export interface GatewayRpcEndpoint<TRequest, TResponse> {
  handle(
    command: GatewayRpcRequest<TRequest>,
  ): Promise<GatewayRpcEndpointResult<TResponse>>;
}
