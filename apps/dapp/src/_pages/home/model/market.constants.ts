export const MARKET_COIN_IDS = [
  'bitcoin',
  'ethereum',
  'tether',
  'binancecoin',
  'solana',
  'ripple',
  'usd-coin',
  'dogecoin',
  'cardano',
  'avalanche-2',
] as const;

export const MARKET_QUOTE_CURRENCY = 'usd' as const;
export const MARKET_REFRESH_INTERVAL_MS = 60_000;
export const MARKET_QUERY_KEY = ['market', 'snapshot', 'usd'] as const;
