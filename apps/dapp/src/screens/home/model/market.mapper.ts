import type { GetMarketsResponse } from '@packages/api-client';
import { MARKET_COIN_IDS } from '@/screens/home/model/market.constants';
import type {
  TMarket,
  TMarketSummary,
  TMarketsSnapshot,
} from '@/screens/home/model/market.schema';
import {
  ZMarketSummary,
  ZMarketsSnapshot,
} from '@/screens/home/model/market.schema';

const MARKET_ORDER = new Map<string, number>(
  MARKET_COIN_IDS.map((marketId, index) => [marketId, index]),
);

const sumOptional = (
  markets: TMarket[],
  select: (market: TMarket) => number | undefined,
): number | undefined => {
  const values = markets.flatMap((market) => {
    const value = select(market);
    return value === undefined ? [] : [value];
  });

  return values.length > 0
    ? values.reduce((total, value) => total + value, 0)
    : undefined;
};

export const mapMarketsResponse = (
  response: GetMarketsResponse,
): TMarketsSnapshot =>
  ZMarketsSnapshot.parse({
    markets: response.markets
      .map((market) => ({
        id: market.id,
        symbol: market.symbol.trim().toUpperCase(),
        name: market.name.trim(),
        imageUrl: market.imageUrl,
        currentPrice: market.currentPrice,
        marketCap: market.marketCap,
        marketCapRank: market.marketCapRank,
        priceChange24h: market.priceChange24h,
        priceChangePercentage24h: market.priceChangePercentage24h,
        totalVolume: market.totalVolume,
        lastUpdated: market.lastUpdated,
      }))
      .toSorted(
        (left, right) =>
          (MARKET_ORDER.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (MARKET_ORDER.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      ),
    vsCurrency: response.vsCurrency,
  });

export const createMarketSummary = (
  snapshot: TMarketsSnapshot,
): TMarketSummary => {
  const strongestGainer = snapshot.markets.reduce<TMarket | undefined>(
    (strongest, market) => {
      const change = market.priceChangePercentage24h;
      if (change === undefined || change <= 0) return strongest;
      if (
        strongest?.priceChangePercentage24h !== undefined &&
        strongest.priceChangePercentage24h >= change
      ) {
        return strongest;
      }
      return market;
    },
    undefined,
  );

  return ZMarketSummary.parse({
    selectedMarketCap: sumOptional(
      snapshot.markets,
      ({ marketCap }) => marketCap,
    ),
    selectedVolume24h: sumOptional(
      snapshot.markets,
      ({ totalVolume }) => totalVolume,
    ),
    gainerCount: snapshot.markets.filter(
      ({ priceChangePercentage24h }) =>
        priceChangePercentage24h !== undefined && priceChangePercentage24h > 0,
    ).length,
    loserCount: snapshot.markets.filter(
      ({ priceChangePercentage24h }) =>
        priceChangePercentage24h !== undefined && priceChangePercentage24h < 0,
    ).length,
    strongestGainer,
  });
};
