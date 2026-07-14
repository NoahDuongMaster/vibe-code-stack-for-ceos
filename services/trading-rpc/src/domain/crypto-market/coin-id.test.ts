import { describe, expect, it } from 'vitest';
import { CoinId, InvalidCoinIdError } from '@/domain/crypto-market/coin-id';

describe('CoinId', () => {
  it('should normalize a valid provider coin identifier', () => {
    expect(CoinId.create('  BitCoin  ').value).toBe('bitcoin');
  });

  it('should reject an identifier outside the crypto-market ubiquitous language', () => {
    expect(() => CoinId.create('bitcoin/usd')).toThrow(InvalidCoinIdError);
  });
});
