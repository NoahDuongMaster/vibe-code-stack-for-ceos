import type { TokenBucketSnapshot } from '@/features/rate-limiting/domain/token-bucket';

/** Outbound domain port for persisting the rate-limit aggregate. */
export interface TokenBucketRepository {
  find(): Promise<TokenBucketSnapshot | undefined>;
  save(snapshot: TokenBucketSnapshot): Promise<void>;
}
