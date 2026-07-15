import type { EnforceRateLimit } from '@/features/rate-limiting/application/enforce-rate-limit/enforce-rate-limit.port';
import type { RateLimiter } from '@/features/rate-limiting/application/enforce-rate-limit/rate-limiter.port';
import { ClientIdentifier } from '@/features/rate-limiting/domain/client-identifier';
import type { RateLimitPolicy } from '@/features/rate-limiting/domain/rate-limit-policy';
import type { GatewayAccessPolicy } from '@/shared/access-policy';
import type { GatewayLogger } from '@/shared/logging';

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
