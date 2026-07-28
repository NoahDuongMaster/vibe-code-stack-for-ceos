import { z } from 'zod';
import {
  MARKET_COIN_IDS,
  MARKET_QUOTE_CURRENCY,
} from '@/screens/dashboard/model/market.constants';

const ZOptionalNonNegativeNumber = z.number().finite().nonnegative().optional();

export const ZMarket = z.object({
  id: z.enum(MARKET_COIN_IDS),
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1),
  imageUrl: z.url().optional(),
  currentPrice: ZOptionalNonNegativeNumber,
  marketCap: ZOptionalNonNegativeNumber,
  marketCapRank: z.number().int().positive().optional(),
  priceChange24h: z.number().finite().optional(),
  priceChangePercentage24h: z.number().finite().optional(),
  totalVolume: ZOptionalNonNegativeNumber,
  lastUpdated: z.iso.datetime({ offset: true }).optional(),
});

export const ZMarketsSnapshot = z
  .object({
    markets: z.array(ZMarket).min(1).max(MARKET_COIN_IDS.length),
    vsCurrency: z.literal(MARKET_QUOTE_CURRENCY),
  })
  .refine(
    ({ markets }) =>
      new Set(markets.map(({ id }) => id)).size === markets.length,
    { message: 'Market IDs must be unique', path: ['markets'] },
  );

export const ZMarketSummary = z.object({
  totalMarketCap: z.number().finite().nonnegative(),
  totalVolume24h: z.number().finite().nonnegative(),
  gainerCount: z.number().int().nonnegative(),
  loserCount: z.number().int().nonnegative(),
});

export type TMarket = z.infer<typeof ZMarket>;
export type TMarketsSnapshot = z.infer<typeof ZMarketsSnapshot>;
export type TMarketSummary = z.infer<typeof ZMarketSummary>;
