import { describe, expect, it } from 'vitest';
import {
  formatCompactUsd,
  formatMarketChange,
  formatMarketPrice,
  formatMarketTimestamp,
} from '@/screens/home/model/market.formatters';

describe('[MarketFormatters]', () => {
  it('should format USD prices, compact totals, changes, and timestamps', () => {
    expect(formatMarketPrice(70_000)).toBe('$70,000.00');
    expect(formatMarketPrice(0.123456)).toBe('$0.123456');
    expect(formatCompactUsd(1_400_000_000_000)).toBe('$1.4T');
    expect(formatMarketChange(2.5)).toBe('+2.50%');
    expect(formatMarketChange(-1.25)).toBe('−1.25%');
    expect(formatMarketTimestamp('2026-07-18T12:00:00.000Z')).toContain(
      'Jul 18, 2026',
    );
  });

  it.each([
    formatMarketPrice,
    formatCompactUsd,
    formatMarketChange,
    formatMarketTimestamp,
  ])('should render missing values as an em dash', (formatter) => {
    expect(formatter(undefined)).toBe('—');
  });
});
