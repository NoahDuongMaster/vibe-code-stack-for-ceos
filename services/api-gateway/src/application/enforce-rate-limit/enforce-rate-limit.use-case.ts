import type { EnforceRateLimit } from '@/application/enforce-rate-limit/enforce-rate-limit.port';
import type { RateLimiter } from '@/application/enforce-rate-limit/rate-limiter.port';
import type { GatewayLogger } from '@/application/shared/gateway-logger.port';
import type { GatewayAccessPolicy } from '@/domain/access-control/gateway-access-policy';
import { ClientIdentifier } from '@/domain/rate-limiting/client-identifier';
import type { RateLimitPolicy } from '@/domain/rate-limiting/rate-limit-policy';

/** Application service applying public-route policy and fail-open availability. */
export class EnforceRateLimitUseCase implements EnforceRateLimit {
  constructor(
    private readonly accessPolicy: GatewayAccessPolicy,
    private readonly rateLimiter: RateLimiter,
    private readonly policy: RateLimitPolicy,
    private readonly logger: GatewayLogger,
  ) {}

  async execute(command: {
    pathname: string;
    clientIdentifier: string | undefined;
    requestId: string | undefined;
  }): Promise<{ allowed: boolean }> {
    if (this.accessPolicy.isPublic(command.pathname)) return { allowed: true };

    try {
      const client = ClientIdentifier.fromTrustedHeader(
        command.clientIdentifier,
      );
      const decision = await this.rateLimiter.consume(client, this.policy);
      return { allowed: decision.success };
    } catch (error) {
      this.logger.warning({
        event: 'rate_limiter_unavailable',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        requestId: command.requestId,
      });
      return { allowed: true };
    }
  }
}
