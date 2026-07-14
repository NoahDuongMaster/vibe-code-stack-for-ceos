import { InvalidQuoteCurrencyError } from '@/domain/crypto-market/errors';

const QUOTE_CURRENCY_PATTERN = /^[a-z]{3,10}$/;

/** Value object for the fiat/crypto unit in which a market snapshot is quoted. */
export class QuoteCurrency {
  private constructor(readonly value: string) {}

  static create(input: string): QuoteCurrency {
    const normalized = input.trim().toLowerCase();
    if (!QUOTE_CURRENCY_PATTERN.test(normalized)) {
      throw new InvalidQuoteCurrencyError();
    }
    return new QuoteCurrency(normalized);
  }
}

export { InvalidQuoteCurrencyError } from '@/domain/crypto-market/errors';
