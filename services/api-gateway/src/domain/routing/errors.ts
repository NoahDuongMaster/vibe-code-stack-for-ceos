export abstract class GatewayRoutingError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UpstreamUnavailableError extends GatewayRoutingError {
  readonly code = 'upstream_unavailable';

  constructor() {
    super('Upstream RPC service is unavailable');
  }
}

export class UpstreamTimeoutError extends GatewayRoutingError {
  readonly code = 'upstream_timeout';

  constructor() {
    super('Upstream RPC service timed out');
  }
}
