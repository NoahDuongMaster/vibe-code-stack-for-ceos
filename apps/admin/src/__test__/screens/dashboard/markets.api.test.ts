import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminGetMarkets = vi.fn();

vi.mock('@/shared/api', () => ({
  adminApiClient: { getMarkets: adminGetMarkets },
}));

describe('getMarkets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should request the admin facade and validate its market response', async () => {
    adminGetMarkets.mockResolvedValue({
      markets: [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          imageUrl: 'https://assets.example.com/bitcoin.png',
          currentPrice: 68_000,
          marketCap: 1_300_000_000_000,
          totalVolume: 38_000_000_000,
          lastUpdated: '2026-07-18T09:30:00.000Z',
        },
      ],
      vsCurrency: 'usd',
    });
    const { getMarkets } = await import('@/screens/dashboard/api/markets.api');

    const snapshot = await getMarkets();

    expect(adminGetMarkets).toHaveBeenCalledWith({
      coinIds: [
        'bitcoin',
        'ethereum',
        'tether',
        'binancecoin',
        'solana',
        'ripple',
        'usd-coin',
        'dogecoin',
      ],
      vsCurrency: 'usd',
    });
    expect(snapshot.markets[0]).toMatchObject({
      id: 'bitcoin',
      symbol: 'BTC',
      imageUrl: 'https://assets.example.com/bitcoin.png',
      currentPrice: 68_000,
    });
  });

  it('should reject an invalid response instead of rendering unsafe data', async () => {
    adminGetMarkets.mockResolvedValue({
      markets: [{ id: 'unknown-coin', symbol: '', name: '' }],
      vsCurrency: 'usd',
    });
    const { getMarkets } = await import('@/screens/dashboard/api/markets.api');

    await expect(getMarkets()).rejects.toThrow();
  });
});
