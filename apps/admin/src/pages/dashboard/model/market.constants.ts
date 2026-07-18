export const MARKET_COIN_IDS = [
  'bitcoin',
  'ethereum',
  'tether',
  'binancecoin',
  'solana',
  'ripple',
  'usd-coin',
  'dogecoin',
] as const;

export const MARKET_QUOTE_CURRENCY = 'usd' as const;
export const MARKET_REFRESH_INTERVAL_MS = 60_000;
export const MARKET_QUERY_KEY = ['admin', 'markets', 'usd'] as const;
