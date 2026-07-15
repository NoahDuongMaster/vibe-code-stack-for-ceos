import { describe, expect, it, vi } from 'vitest';
import { CoinId } from '@/features/market-data/domain/coin-id';
import { MarketDataUnavailableError } from '@/features/market-data/domain/errors';
import { QuoteCurrency } from '@/features/market-data/domain/quote-currency';
import { createCoinGeckoMarketDataProvider } from '@/features/market-data/infra/coingecko/coingecko-market-data.adapter';

describe('createCoinGeckoMarketDataProvider', () => {
  it('should translate CoinGecko data into provider-neutral market snapshots', async () => {
    const fetchMock = vi.fn(
      async (
        _input: Parameters<typeof globalThis.fetch>[0],
        _init?: Parameters<typeof globalThis.fetch>[1],
      ) =>
        new Response(
          JSON.stringify([
            {
              id: 'bitcoin',
              symbol: 'btc',
              name: 'Bitcoin',
              image: 'https://images.example.com/bitcoin.png',
              current_price: 70_000,
              market_cap: 1_400_000_000_000,
              market_cap_rank: 1,
              price_change_24h: 500,
              price_change_percentage_24h: 0.72,
              total_volume: 20_000_000_000,
              last_updated: '2026-07-13T00:00:00.000Z',
            },
          ]),
          { headers: { 'content-type': 'application/json' } },
        ),
    );
    const provider = createCoinGeckoMarketDataProvider({
      apiKey: 'demo-key',
      fetch: fetchMock,
    });

    const markets = await provider.getMarkets({
      coinIds: [CoinId.create('bitcoin'), CoinId.create('ethereum')],
      quoteCurrency: QuoteCurrency.create('usd'),
    });

    expect(markets.map((market) => market.toPrimitives())).toEqual([
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://images.example.com/bitcoin.png',
        currentPrice: 70_000,
        marketCap: 1_400_000_000_000,
        marketCapRank: 1,
        priceChange24h: 500,
        priceChangePercentage24h: 0.72,
        totalVolume: 20_000_000_000,
        lastUpdated: '2026-07-13T00:00:00.000Z',
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const requestUrl = new URL(String(url));
    expect(requestUrl.origin).toBe('https://api.coingecko.com');
    expect(requestUrl.pathname).toBe('/api/v3/coins/markets');
    expect(requestUrl.searchParams.get('ids')).toBe('bitcoin,ethereum');
    expect(requestUrl.searchParams.get('vs_currency')).toBe('usd');
    expect(requestUrl.searchParams.get('price_change_percentage')).toBe('24h');
    expect(new Headers(init?.headers).get('x-cg-demo-api-key')).toBe(
      'demo-key',
    );
  });

  it('should translate provider failures into a safe domain error', async () => {
    const provider = createCoinGeckoMarketDataProvider({
      fetch: vi.fn(
        async () => new Response('upstream detail', { status: 429 }),
      ),
    });

    await expect(
      provider.getMarkets({
        coinIds: [CoinId.create('bitcoin')],
        quoteCurrency: QuoteCurrency.create('usd'),
      }),
    ).rejects.toBeInstanceOf(MarketDataUnavailableError);
  });
});
