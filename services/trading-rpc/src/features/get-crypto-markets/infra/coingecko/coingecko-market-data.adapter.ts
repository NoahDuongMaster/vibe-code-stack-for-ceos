import { z } from 'zod';
import { CoinId } from '../../domain/coin-id';
import { MarketDataUnavailableError } from '../../domain/errors';
import type {
  MarketDataProvider,
  MarketDataQuery,
} from '../../domain/market-data-provider.port';
import {
  MarketSnapshot,
  type MarketSnapshotProperties,
} from '../../domain/market-snapshot';

const COINGECKO_API_ORIGIN = 'https://api.coingecko.com';

const ZCoinGeckoMarketsResponse = z.array(
  z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    image: z.string().nullable().optional(),
    current_price: z.number().finite().nullable().optional(),
    market_cap: z.number().finite().nullable().optional(),
    market_cap_rank: z.number().int().nullable().optional(),
    price_change_24h: z.number().finite().nullable().optional(),
    price_change_percentage_24h: z.number().finite().nullable().optional(),
    total_volume: z.number().finite().nullable().optional(),
    last_updated: z.string().nullable().optional(),
  }),
);

export interface CoinGeckoMarketDataProviderOptions {
  /** CoinGecko Demo API key. Leave undefined only for controlled test doubles. */
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

const toOptional = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

const toMarketSnapshot = (
  market: z.infer<typeof ZCoinGeckoMarketsResponse>[number],
): MarketSnapshot => {
  const properties: MarketSnapshotProperties = {
    coinId: CoinId.create(market.id),
    symbol: market.symbol,
    name: market.name,
    imageUrl: toOptional(market.image),
    currentPrice: toOptional(market.current_price),
    marketCap: toOptional(market.market_cap),
    marketCapRank: toOptional(market.market_cap_rank),
    priceChange24h: toOptional(market.price_change_24h),
    priceChangePercentage24h: toOptional(market.price_change_percentage_24h),
    totalVolume: toOptional(market.total_volume),
    lastUpdated: toOptional(market.last_updated),
  };
  return new MarketSnapshot(properties);
};

/**
 * CoinGecko outbound adapter. Provider-specific transport and response details
 * terminate here; the application receives only domain snapshots or a safe
 * domain availability error.
 */
export const createCoinGeckoMarketDataProvider = (
  options: CoinGeckoMarketDataProviderOptions = {},
): MarketDataProvider => {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    async getMarkets(
      query: MarketDataQuery,
    ): Promise<readonly MarketSnapshot[]> {
      const url = new URL('/api/v3/coins/markets', COINGECKO_API_ORIGIN);
      url.searchParams.set(
        'ids',
        query.coinIds.map((coinId) => coinId.value).join(','),
      );
      url.searchParams.set('vs_currency', query.quoteCurrency.value);
      url.searchParams.set('price_change_percentage', '24h');

      let response: Response;
      try {
        response = await fetcher(url, {
          headers: options.apiKey
            ? { 'x-cg-demo-api-key': options.apiKey }
            : undefined,
        });
      } catch {
        throw new MarketDataUnavailableError();
      }

      if (!response.ok) throw new MarketDataUnavailableError();

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new MarketDataUnavailableError();
      }

      const parsed = ZCoinGeckoMarketsResponse.safeParse(payload);
      if (!parsed.success) throw new MarketDataUnavailableError();

      try {
        return parsed.data.map(toMarketSnapshot);
      } catch {
        throw new MarketDataUnavailableError();
      }
    },
  };
};
