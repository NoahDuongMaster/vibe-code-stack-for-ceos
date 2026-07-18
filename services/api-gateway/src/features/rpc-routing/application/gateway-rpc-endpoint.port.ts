export interface GatewayRpcRequest<TRequest> {
  request: TRequest;
  requestId: string;
  rpcPath: string;
}

export interface GatewayRpcEndpointResult<TResponse> {
  handled: boolean;
  response: TResponse;
}

/** Driven port for a local RPC runtime or one private service endpoint. */
export interface GatewayRpcEndpoint<TRequest, TResponse> {
  handle(
    command: GatewayRpcRequest<TRequest>,
  ): Promise<GatewayRpcEndpointResult<TResponse>>;
}
