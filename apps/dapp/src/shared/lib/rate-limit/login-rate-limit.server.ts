import 'server-only';

import { env } from '@/shared/config';
import { isRateLimited } from '@/shared/lib/rate-limit/rate-limit';

const LOGIN_RATE_LIMIT_POLICY = { limit: 10, periodMs: 60_000 } as const;

interface TLoginRateLimiterStub {
  limit(policy: typeof LOGIN_RATE_LIMIT_POLICY): Promise<{ success: boolean }>;
}

interface TLoginRateLimiterNamespace {
  get(id: unknown): TLoginRateLimiterStub;
  idFromName(name: string): unknown;
}

interface TDappCloudflareBindings {
  LOGIN_RATE_LIMITER?: TLoginRateLimiterNamespace;
}

export class DistributedRateLimiterUnavailableError extends Error {
  readonly code = 'distributed_rate_limiter_unavailable';

  constructor(options?: ErrorOptions) {
    super('Distributed login rate limiter is unavailable', options);
    this.name = 'DistributedRateLimiterUnavailableError';
  }
}

const loadCloudflareRateLimiter =
  async (): Promise<TLoginRateLimiterNamespace> => {
    try {
      const { env } = await import('cloudflare:workers');
      const bindings = env as unknown as TDappCloudflareBindings;
      if (bindings.LOGIN_RATE_LIMITER) return bindings.LOGIN_RATE_LIMITER;
    } catch (error) {
      throw new DistributedRateLimiterUnavailableError({ cause: error });
    }

    throw new DistributedRateLimiterUnavailableError();
  };

/**
 * Uses an exact Durable Object token bucket in production. Local development
 * intentionally keeps the fast in-process limiter, while production fails
 * closed if its cross-Worker binding is missing or unavailable.
 */
export const isLoginRateLimited = async (
  clientKey: string,
): Promise<boolean> => {
  const mode = env.server.DAPP_LOGIN_RATE_LIMIT_MODE;
  if (mode === 'local' || (!mode && process.env.NODE_ENV !== 'production')) {
    return isRateLimited(`login:${clientKey}`, LOGIN_RATE_LIMIT_POLICY);
  }

  const namespace = await loadCloudflareRateLimiter();
  const id = namespace.idFromName(`dapp-login:${clientKey}`);

  try {
    const decision = await namespace.get(id).limit(LOGIN_RATE_LIMIT_POLICY);
    return !decision.success;
  } catch (error) {
    throw new DistributedRateLimiterUnavailableError({ cause: error });
  }
};
