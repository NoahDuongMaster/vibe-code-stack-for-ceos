import type { Page, Route } from '@playwright/test';

const MARKET_RPC_PATTERN = '**/trading.v1.TradingService/GetMarkets' as const;
const MARKET_LOGO_PATTERN =
  'https://coin-images.coingecko.com/e2e-fixtures/market-logo/*.svg' as const;

const logoUrl = (symbol: string): string =>
  `https://coin-images.coingecko.com/e2e-fixtures/market-logo/${symbol}.svg`;

const LOGO_COLORS: Record<string, string> = {
  ADA: '#2A6FFF',
  AVAX: '#E84142',
  BNB: '#F3BA2F',
  BTC: '#F7931A',
  DOGE: '#C2A633',
  ETH: '#8C8CFF',
  SOL: '#14F195',
  USDC: '#2775CA',
  USDT: '#26A17B',
  XRP: '#E9F1E2',
};

const logoSvg = (symbol: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="${LOGO_COLORS[symbol] ?? '#8B5CF6'}"/><text x="32" y="38" text-anchor="middle" fill="#050507" font-family="monospace" font-size="18" font-weight="700">${symbol}</text></svg>`;

const MARKET_RESPONSE = {
  markets: [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      imageUrl: logoUrl('BTC'),
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
      imageUrl: logoUrl('ETH'),
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
      imageUrl: logoUrl('USDT'),
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
      imageUrl: logoUrl('BNB'),
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
      imageUrl: logoUrl('SOL'),
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
      imageUrl: logoUrl('XRP'),
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
      imageUrl: logoUrl('USDC'),
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
      imageUrl: logoUrl('DOGE'),
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
      imageUrl: logoUrl('ADA'),
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
      imageUrl: logoUrl('AVAX'),
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
  getLogoRequestCount: () => number;
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
  let logoRequestCount = 0;
  let requestCount = 0;

  await page.route(MARKET_LOGO_PATTERN, async (route) => {
    logoRequestCount += 1;
    const symbol = new URL(route.request().url()).pathname
      .split('/')
      .at(-1)
      ?.replace('.svg', '');
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: logoSvg(symbol ?? ''),
    });
  });

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

  return {
    getLogoRequestCount: () => logoRequestCount,
    getRequestCount: () => requestCount,
  };
};
