import { describe, expect, it } from 'vitest';
import {
  InvalidQuoteCurrencyError,
  QuoteCurrency,
} from '@/features/market-data/domain/quote-currency';

describe('QuoteCurrency', () => {
  it('should normalize an allowed quote currency', () => {
    expect(QuoteCurrency.create(' UsD ').value).toBe('usd');
  });

  it('should reject a non-currency quote value', () => {
    expect(() => QuoteCurrency.create('usd-coin')).toThrow(
      InvalidQuoteCurrencyError,
    );
  });
});
