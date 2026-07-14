import type { AuthorizeGatewayRequest } from '@/application/authorize-gateway-request/authorize-gateway-request.port';
import type { TokenVerifier } from '@/application/authorize-gateway-request/token-verifier.port';
import type { GatewayAccessPolicy } from '@/domain/access-control/gateway-access-policy';

const BEARER_PREFIX = 'Bearer ';

/** Application service coordinating public-route policy and token verification. */
export class AuthorizeGatewayRequestUseCase implements AuthorizeGatewayRequest {
  constructor(
    private readonly accessPolicy: GatewayAccessPolicy,
    private readonly tokenVerifier: TokenVerifier,
    private readonly jwtSecret: string | undefined,
  ) {}

  async execute(command: {
    pathname: string;
    authorizationHeader: string | undefined;
  }): Promise<{ allowed: boolean }> {
    if (!this.jwtSecret || this.accessPolicy.isPublic(command.pathname)) {
      return { allowed: true };
    }

    const header = command.authorizationHeader;
    if (!header?.startsWith(BEARER_PREFIX)) return { allowed: false };

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) return { allowed: false };

    return {
      allowed: await this.tokenVerifier.verify(token, this.jwtSecret),
    };
  }
}
