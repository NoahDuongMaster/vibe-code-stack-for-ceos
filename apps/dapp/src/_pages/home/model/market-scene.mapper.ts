import type { TMarket } from '@/_pages/home/model/market.schema';

export const MARKET_POSITIVE_COLOR = '#C7FF2F';
export const MARKET_NEGATIVE_COLOR = '#FF3B5C';
export const MARKET_NEUTRAL_COLOR = '#8B5CF6';

const MIN_HEIGHT = 0.9;
const MAX_HEIGHT = 3.6;
const MIN_WIDTH = 0.54;
const MAX_WIDTH = 0.86;
const MIN_DEPTH = 0.5;
const MAX_DEPTH = 0.78;
const MIN_PULSE = 0.18;
const MAX_PULSE = 1;
const MIN_EMISSIVE = 0.3;
const MAX_EMISSIVE = 1.35;
const MAX_CHANGE_MAGNITUDE = 15;

export type TMarketSceneNode = {
  id: TMarket['id'];
  symbol: string;
  position: readonly [number, number, number];
  height: number;
  width: number;
  depth: number;
  lean: number;
  pulseStrength: number;
  revealDelay: number;
  color: string;
  emissiveIntensity: number;
};

const normalizeLogValues = (
  markets: TMarket[],
  select: (market: TMarket) => number | undefined,
): Map<TMarket['id'], number> => {
  const entries = markets.flatMap((market) => {
    const value = select(market);
    return value === undefined
      ? []
      : ([[market.id, Math.log1p(value)]] as const);
  });
  const values = entries.map(([, value]) => value);
  const minimum = values.length > 0 ? Math.min(...values) : 0;
  const maximum = values.length > 0 ? Math.max(...values) : 0;
  const range = maximum - minimum;

  return new Map(
    entries.map(([id, value]) => [
      id,
      range === 0 ? 0.5 : (value - minimum) / range,
    ]),
  );
};

export const mapMarketsToScene = (markets: TMarket[]): TMarketSceneNode[] => {
  const normalizedCaps = normalizeLogValues(
    markets,
    ({ marketCap }) => marketCap,
  );
  const normalizedVolumes = normalizeLogValues(
    markets,
    ({ totalVolume }) => totalVolume,
  );

  return markets.map((market, index) => {
    const change = market.priceChangePercentage24h ?? 0;
    const normalizedChange =
      Math.min(Math.abs(change), MAX_CHANGE_MAGNITUDE) / MAX_CHANGE_MAGNITUDE;
    const normalizedCap = normalizedCaps.get(market.id) ?? 0.18;
    const normalizedVolume = normalizedVolumes.get(market.id) ?? 0.18;
    const column = index % 5;
    const row = index < 5 ? -1 : 1;

    return {
      id: market.id,
      symbol: market.symbol,
      position: [(column - 2) * 1.25, 0, row * 1.45],
      height:
        Math.round(
          (MIN_HEIGHT + normalizedCap * (MAX_HEIGHT - MIN_HEIGHT)) * 10_000,
        ) / 10_000,
      width: MIN_WIDTH + normalizedCap * (MAX_WIDTH - MIN_WIDTH),
      depth: MIN_DEPTH + normalizedCap * (MAX_DEPTH - MIN_DEPTH),
      lean: Math.sign(change) * (0.08 + normalizedChange * 0.18),
      pulseStrength: MIN_PULSE + normalizedVolume * (MAX_PULSE - MIN_PULSE),
      revealDelay: index * 0.06,
      color:
        change > 0
          ? MARKET_POSITIVE_COLOR
          : change < 0
            ? MARKET_NEGATIVE_COLOR
            : MARKET_NEUTRAL_COLOR,
      emissiveIntensity:
        MIN_EMISSIVE + normalizedChange * (MAX_EMISSIVE - MIN_EMISSIVE),
    };
  });
};
