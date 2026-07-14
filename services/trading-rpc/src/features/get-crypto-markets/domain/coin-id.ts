import { InvalidCoinIdError } from './errors';

const COIN_ID_PATTERN = /^[a-z0-9-]+$/;
const MAX_COIN_ID_LENGTH = 100;

/**
 * Value object for the provider-neutral identity of a crypto asset.
 *
 * CoinGecko-compatible IDs are deliberately normalized here so every inner
 * layer operates on the same ubiquitous-language representation.
 */
export class CoinId {
  private constructor(readonly value: string) {}

  static create(input: string): CoinId {
    const normalized = input.trim().toLowerCase();
    if (
      normalized.length === 0 ||
      normalized.length > MAX_COIN_ID_LENGTH ||
      !COIN_ID_PATTERN.test(normalized)
    ) {
      throw new InvalidCoinIdError();
    }
    return new CoinId(normalized);
  }
}

export { InvalidCoinIdError } from './errors';
