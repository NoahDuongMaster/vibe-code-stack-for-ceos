export interface TCoinMarket {
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
