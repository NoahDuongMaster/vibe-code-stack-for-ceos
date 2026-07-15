import type { TokenBucketSnapshot } from '@/features/rate-limiting/domain/token-bucket';
import type { TokenBucketRepository } from '@/features/rate-limiting/domain/token-bucket.repository.port';

const BUCKET_KEY = 'bucket';

/** Durable Object storage adapter for the token-bucket aggregate repository. */
export class DurableObjectTokenBucketRepository
  implements TokenBucketRepository
{
  constructor(private readonly storage: DurableObjectStorage) {}

  find(): Promise<TokenBucketSnapshot | undefined> {
    return this.storage.get<TokenBucketSnapshot>(BUCKET_KEY);
  }

  async save(snapshot: TokenBucketSnapshot): Promise<void> {
    await this.storage.put(BUCKET_KEY, snapshot);
  }
}
