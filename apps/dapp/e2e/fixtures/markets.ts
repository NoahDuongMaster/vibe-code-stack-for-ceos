import type { Page, Route } from '@playwright/test';

const MARKET_RPC_PATTERN = '**/trading.v1.TradingService/GetMarkets' as const;

const MARKET_RESPONSE = {
  markets: [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      currentPrice: 118_420.12,
      marketCap: 2_356_000_000_000,
      marketCapRank: 1,
      priceChange24h: 2_430.21,
      priceChangePercentage24h: 2.09,
      totalVolume: 52_300_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      currentPrice: 4_180.42,
      marketCap: 504_000_000_000,
      marketCapRank: 2,
      priceChange24h: 164.72,
      priceChangePercentage24h: 4.1,
      totalVolume: 31_800_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'tether',
      symbol: 'usdt',
      name: 'Tether',
      currentPrice: 1,
      marketCap: 158_000_000_000,
      marketCapRank: 3,
      priceChange24h: 0,
      priceChangePercentage24h: 0,
      totalVolume: 74_000_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'binancecoin',
      symbol: 'bnb',
      name: 'BNB',
      currentPrice: 812.64,
      marketCap: 113_000_000_000,
      marketCapRank: 4,
      priceChange24h: -7.81,
      priceChangePercentage24h: -0.95,
      totalVolume: 2_100_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'solana',
      symbol: 'sol',
      name: 'Solana',
      currentPrice: 218.19,
      marketCap: 109_000_000_000,
      marketCapRank: 5,
      priceChange24h: 12.08,
      priceChangePercentage24h: 5.86,
      totalVolume: 9_700_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'ripple',
      symbol: 'xrp',
      name: 'XRP',
      currentPrice: 3.22,
      marketCap: 190_000_000_000,
      marketCapRank: 6,
      priceChange24h: -0.08,
      priceChangePercentage24h: -2.42,
      totalVolume: 8_400_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'usd-coin',
      symbol: 'usdc',
      name: 'USDC',
      currentPrice: 1,
      marketCap: 63_000_000_000,
      marketCapRank: 7,
      priceChange24h: 0,
      priceChangePercentage24h: 0,
      totalVolume: 12_800_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'dogecoin',
      symbol: 'doge',
      name: 'Dogecoin',
      currentPrice: 0.31,
      marketCap: 46_000_000_000,
      marketCapRank: 8,
      priceChange24h: 0.01,
      priceChangePercentage24h: 3.33,
      totalVolume: 3_900_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'cardano',
      symbol: 'ada',
      name: 'Cardano',
      currentPrice: 0.88,
      marketCap: 31_000_000_000,
      marketCapRank: 9,
      priceChange24h: -0.03,
      priceChangePercentage24h: -3.3,
      totalVolume: 1_700_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
    {
      id: 'avalanche-2',
      symbol: 'avax',
      name: 'Avalanche',
      currentPrice: 36.78,
      marketCap: 15_600_000_000,
      marketCapRank: 10,
      priceChange24h: 1.02,
      priceChangePercentage24h: 2.85,
      totalVolume: 940_000_000,
      lastUpdated: '2026-07-18T08:30:00.000Z',
    },
  ],
  vsCurrency: 'usd',
} as const;

type TMarketApiMockOptions = {
  failFirstRequests?: number;
};

type TMarketApiMock = {
  getRequestCount: () => number;
};

const corsHeaders = (page: Page) => ({
  'access-control-allow-headers':
    'Content-Type, Connect-Protocol-Version, Connect-Timeout-Ms',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-origin': new URL(page.url()).origin,
  'access-control-expose-headers': 'Connect-Content-Encoding',
  vary: 'Origin',
});

const fulfillPreflight = async (route: Route, page: Page) => {
  await route.fulfill({
    status: 204,
    headers: corsHeaders(page),
    body: '',
  });
};

export const installMarketApiMock = async (
  page: Page,
  { failFirstRequests = 0 }: TMarketApiMockOptions = {},
): Promise<TMarketApiMock> => {
  let requestCount = 0;

  await page.route(MARKET_RPC_PATTERN, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillPreflight(route, page);
      return;
    }

    requestCount += 1;
    const headers = {
      ...corsHeaders(page),
      'content-type': 'application/json',
    };

    if (requestCount <= failFirstRequests) {
      await route.fulfill({
        status: 503,
        headers,
        json: { code: 'unavailable', message: 'Fixture gateway unavailable' },
      });
      return;
    }

    await route.fulfill({ status: 200, headers, json: MARKET_RESPONSE });
  });

  return { getRequestCount: () => requestCount };
};
