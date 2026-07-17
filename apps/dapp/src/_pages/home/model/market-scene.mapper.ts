import type { TMarket } from '@/_pages/home/model/market.schema';

export const MARKET_POSITIVE_COLOR = '#67e8f9';
export const MARKET_NEGATIVE_COLOR = '#fb7185';
export const MARKET_NEUTRAL_COLOR = '#a78bfa';

const MIN_SCALE = 0.72;
const MAX_SCALE = 1.32;
const MIN_EMISSIVE_INTENSITY = 0.35;
const MAX_EMISSIVE_INTENSITY = 1.4;
const MAX_CHANGE_MAGNITUDE = 15;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type TMarketSceneNode = {
  id: TMarket['id'];
  symbol: string;
  scale: number;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  verticalOffset: number;
  color: string;
  emissiveIntensity: number;
};

const normalizeMarketCaps = (
  markets: TMarket[],
): Map<TMarket['id'], number> => {
  const logarithmicCaps = markets.flatMap(({ id, marketCap }) =>
    marketCap === undefined ? [] : [[id, Math.log1p(marketCap)] as const],
  );
  const values = logarithmicCaps.map(([, value]) => value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const range = maximum - minimum;

  return new Map(
    logarithmicCaps.map(([id, value]) => [
      id,
      range === 0 ? 0.5 : (value - minimum) / range,
    ]),
  );
};

export const mapMarketsToScene = (markets: TMarket[]): TMarketSceneNode[] => {
  const normalizedCaps = normalizeMarketCaps(markets);

  return markets.map((market, index) => {
    const change = market.priceChangePercentage24h ?? 0;
    const normalizedChange =
      Math.min(Math.abs(change), MAX_CHANGE_MAGNITUDE) / MAX_CHANGE_MAGNITUDE;
    const normalizedCap = normalizedCaps.get(market.id) ?? 0.18;

    return {
      id: market.id,
      symbol: market.symbol,
      scale: MIN_SCALE + normalizedCap * (MAX_SCALE - MIN_SCALE),
      orbitRadius: 2.4 + (index % 5) * 0.6,
      orbitSpeed: 0.08 + normalizedChange * 0.1,
      phase: (index * GOLDEN_ANGLE) % (Math.PI * 2),
      verticalOffset: ((index % 3) - 1) * 0.55,
      color:
        change > 0
          ? MARKET_POSITIVE_COLOR
          : change < 0
            ? MARKET_NEGATIVE_COLOR
            : MARKET_NEUTRAL_COLOR,
      emissiveIntensity:
        MIN_EMISSIVE_INTENSITY +
        normalizedChange * (MAX_EMISSIVE_INTENSITY - MIN_EMISSIVE_INTENSITY),
    };
  });
};
