import type { CoinId } from '@/features/market-data/domain/coin-id';
import { InvalidMarketSnapshotError } from '@/features/market-data/domain/errors';

export interface MarketSnapshotProperties {
  coinId: CoinId;
  symbol: string;
  name: string;
  imageUrl?: string;
  currentPrice?: number;
  marketCap?: number;
  marketCapRank?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  totalVolume?: number;
  lastUpdated?: string;
}

export interface MarketSnapshotPrimitives {
  id: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  currentPrice?: number;
  marketCap?: number;
  marketCapRank?: number;
  priceChange24h?: number;
  priceChangePercentage24h?: number;
  totalVolume?: number;
  lastUpdated?: string;
}

const optionalNumbers = [
  'currentPrice',
  'marketCap',
  'marketCapRank',
  'priceChange24h',
  'priceChangePercentage24h',
  'totalVolume',
] as const;

/**
 * Immutable market state received at a point in time. It is a domain value
 * model, not an aggregate: this bounded context does not own its lifecycle.
 */
export class MarketSnapshot {
  readonly coinId: CoinId;
  readonly symbol: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly currentPrice?: number;
  readonly marketCap?: number;
  readonly marketCapRank?: number;
  readonly priceChange24h?: number;
  readonly priceChangePercentage24h?: number;
  readonly totalVolume?: number;
  readonly lastUpdated?: string;

  constructor(properties: MarketSnapshotProperties) {
    const symbol = properties.symbol.trim().toLowerCase();
    const name = properties.name.trim();
    if (symbol.length === 0 || name.length === 0) {
      throw new InvalidMarketSnapshotError();
    }
    for (const field of optionalNumbers) {
      const value = properties[field];
      if (value !== undefined && !Number.isFinite(value)) {
        throw new InvalidMarketSnapshotError();
      }
    }
    if (
      properties.marketCapRank !== undefined &&
      (!Number.isInteger(properties.marketCapRank) ||
        properties.marketCapRank < 1)
    ) {
      throw new InvalidMarketSnapshotError();
    }

    this.coinId = properties.coinId;
    this.symbol = symbol;
    this.name = name;
    this.imageUrl = properties.imageUrl;
    this.currentPrice = properties.currentPrice;
    this.marketCap = properties.marketCap;
    this.marketCapRank = properties.marketCapRank;
    this.priceChange24h = properties.priceChange24h;
    this.priceChangePercentage24h = properties.priceChangePercentage24h;
    this.totalVolume = properties.totalVolume;
    this.lastUpdated = properties.lastUpdated;
  }

  toPrimitives(): MarketSnapshotPrimitives {
    return {
      id: this.coinId.value,
      symbol: this.symbol,
      name: this.name,
      imageUrl: this.imageUrl,
      currentPrice: this.currentPrice,
      marketCap: this.marketCap,
      marketCapRank: this.marketCapRank,
      priceChange24h: this.priceChange24h,
      priceChangePercentage24h: this.priceChangePercentage24h,
      totalVolume: this.totalVolume,
      lastUpdated: this.lastUpdated,
    };
  }
}
