import type { AdminServiceGetMarketsResponse } from '@packages/api-client';
import { MARKET_COIN_IDS } from '@/screens/dashboard/model/market.constants';
import type {
  TMarketSummary,
  TMarketsSnapshot,
} from '@/screens/dashboard/model/market.schema';
import {
  ZMarketSummary,
  ZMarketsSnapshot,
} from '@/screens/dashboard/model/market.schema';

const MARKET_ORDER = new Map<string, number>(
  MARKET_COIN_IDS.map((marketId, index) => [marketId, index]),
);

export const mapMarketsResponse = (
  response: AdminServiceGetMarketsResponse,
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
): TMarketSummary =>
  ZMarketSummary.parse({
    totalMarketCap: snapshot.markets.reduce(
      (total, market) => total + (market.marketCap ?? 0),
      0,
    ),
    totalVolume24h: snapshot.markets.reduce(
      (total, market) => total + (market.totalVolume ?? 0),
      0,
    ),
    gainerCount: snapshot.markets.filter(
      ({ priceChangePercentage24h }) =>
        priceChangePercentage24h !== undefined && priceChangePercentage24h > 0,
    ).length,
    loserCount: snapshot.markets.filter(
      ({ priceChangePercentage24h }) =>
        priceChangePercentage24h !== undefined && priceChangePercentage24h < 0,
    ).length,
  });
