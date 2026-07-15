export interface AuthorizeGatewayRequestCommand {
  pathname: string;
  authorizationHeader: string | undefined;
}

export interface AuthorizationDecision {
  allowed: boolean;
}

/** Driving port for the gateway access-control use case. */
export interface AuthorizeGatewayRequest {
  execute(
    command: AuthorizeGatewayRequestCommand,
  ): Promise<AuthorizationDecision>;
}
