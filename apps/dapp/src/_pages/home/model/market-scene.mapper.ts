import type { TMarket } from '@/_pages/home/model/market.schema';

export const MARKET_POSITIVE_COLOR = '#C7FF2F';
export const MARKET_NEGATIVE_COLOR = '#FF3B5C';
export const MARKET_NEUTRAL_COLOR = '#8B5CF6';

const MAX_CHANGE_MAGNITUDE = 15;
const MIN_RADIUS = 0.48;
const MAX_RADIUS = 1.05;
const MIN_ACTIVITY = 0.2;
const MAX_ACTIVITY = 1;
const MIN_HALO = 0.25;
const MAX_HALO = 1;

export type TVector3Tuple = readonly [number, number, number];

export type TMarketBubbleNode = {
  id: TMarket['id'];
  symbol: string;
  name: string;
  imageUrl?: string;
  radius: number;
  mass: number;
  seedPosition: TVector3Tuple;
  seedVelocity: TVector3Tuple;
  activity: number;
  haloColor: string;
  haloIntensity: number;
};

const POSITION_SLOTS: readonly TVector3Tuple[] = [
  [-3.2, -1.25, 0],
  [0, 1.25, 0],
  [3.2, -1.25, 0],
  [-1.6, 1.25, 0],
  [1.6, 1.25, 0],
  [0, -1.25, 0],
  [-3.2, 1.25, 0],
  [3.2, 1.25, 0],
  [-1.6, -1.25, 0],
  [1.6, -1.25, 0],
];

const round = (value: number): number => Math.round(value * 10_000) / 10_000;

const hashUnit = (input: string): number => {
  let hash = 2_166_136_261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85eb_ca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2_ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4_294_967_295;
};

const seededTuple = (id: string, range: TVector3Tuple): TVector3Tuple => [
  round((hashUnit(`x:${id}`) * 2 - 1) * range[0]),
  round((hashUnit(`y:${id}`) * 2 - 1) * range[1]),
  round((hashUnit(`z:${id}`) * 2 - 1) * range[2]),
];

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

export const mapMarketsToBubbles = (
  markets: TMarket[],
): TMarketBubbleNode[] => {
  const caps = normalizeLogValues(markets, ({ marketCap }) => marketCap);
  const volumes = normalizeLogValues(markets, ({ totalVolume }) => totalVolume);
  const positionById = new Map<TMarket['id'], TVector3Tuple>(
    [...markets]
      .sort(
        (left, right) =>
          (caps.get(right.id) ?? 0.18) - (caps.get(left.id) ?? 0.18) ||
          left.id.localeCompare(right.id),
      )
      .map((market, index): readonly [TMarket['id'], TVector3Tuple] => {
        const slot = POSITION_SLOTS[index] ?? [0, 0, 0];
        return [
          market.id,
          [
            slot[0],
            slot[1],
            round((hashUnit(`depth:${market.id}`) * 2 - 1) * 0.28),
          ],
        ];
      }),
  );

  return markets.map((market) => {
    const cap = caps.get(market.id) ?? 0.18;
    const volume = volumes.get(market.id) ?? 0.18;
    const change = market.priceChangePercentage24h ?? 0;
    const changeMagnitude =
      Math.min(Math.abs(change), MAX_CHANGE_MAGNITUDE) / MAX_CHANGE_MAGNITUDE;
    const radius = round(MIN_RADIUS + cap * (MAX_RADIUS - MIN_RADIUS));

    return {
      id: market.id,
      symbol: market.symbol,
      name: market.name,
      imageUrl: market.imageUrl,
      radius,
      mass: radius ** 3,
      seedPosition: positionById.get(market.id) ?? [0, 0, 0],
      seedVelocity: seededTuple(`${market.id}:velocity`, [0.16, 0.12, 0.08]),
      activity: round(MIN_ACTIVITY + volume * (MAX_ACTIVITY - MIN_ACTIVITY)),
      haloColor:
        change > 0
          ? MARKET_POSITIVE_COLOR
          : change < 0
            ? MARKET_NEGATIVE_COLOR
            : MARKET_NEUTRAL_COLOR,
      haloIntensity: round(MIN_HALO + changeMagnitude * (MAX_HALO - MIN_HALO)),
    };
  });
};
