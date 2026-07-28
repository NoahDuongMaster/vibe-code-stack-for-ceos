import type { TMarket } from '@/screens/home/model/market.schema';
import {
  mapMarketsToBubbles,
  type TMarketBubbleNode,
} from '@/screens/home/model/market-scene.mapper';
import { MarketLogo } from '@/screens/home/ui/market-logo';
import { css, cx } from '@/styled-system/css';

const DEFAULT_MARKETS: TMarket[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USDC' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
];

const DEFAULT_NODES = mapMarketsToBubbles(DEFAULT_MARKETS);

const fallbackStyle = css({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  bgColor: 'void',
  backgroundImage:
    'radial-gradient(circle at 18% 22%, rgba(139, 92, 246, 0.24), transparent 34%), radial-gradient(circle at 78% 70%, rgba(199, 255, 47, 0.1), transparent 32%), linear-gradient(145deg, #050507 0%, #090B12 56%, #050507 100%)',
  _after: {
    content: '""',
    position: 'absolute',
    inset: 0,
    opacity: 0.35,
    backgroundImage:
      'radial-gradient(circle, rgba(233, 241, 226, 0.8) 0 1px, transparent 1.5px)',
    backgroundSize: '47px 47px',
    maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
  },
});

const bubbleStyle = css({
  position: 'absolute',
  zIndex: 1,
  display: 'grid',
  placeItems: 'center',
  borderWidth: '1px',
  borderRadius: 'full',
  bgColor: 'carbon/86',
  backdropFilter: 'blur(8px)',
  transform: 'translate(-50%, -50%)',
});

const activeBubbleStyle = css({
  zIndex: 3,
  transform: 'translate(-50%, -50%) scale(1.08)',
});

const labelStyle = css({
  position: 'absolute',
  top: 'calc(100% + 0.35rem)',
  insetInlineStart: '50%',
  maxW: '28',
  overflow: 'hidden',
  color: 'bone/72',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  fontWeight: '500',
  letterSpacing: '0.06em',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap',
});

const clampPercent = (value: number): number =>
  Math.min(90, Math.max(10, value));

const logoSize = (radius: number): 28 | 32 | 40 => {
  if (radius >= 0.9) return 40;
  return radius >= 0.65 ? 32 : 28;
};

export function MarketSceneFallback({
  activeMarketId,
  markets = DEFAULT_MARKETS,
  nodes = DEFAULT_NODES,
}: {
  activeMarketId?: TMarket['id'];
  markets?: TMarket[];
  nodes?: TMarketBubbleNode[];
} = {}) {
  const marketById = new Map(markets.map((market) => [market.id, market]));

  return (
    <div
      data-testid="market-scene-fallback"
      aria-hidden="true"
      className={fallbackStyle}
    >
      {nodes.map((node) => {
        const market = marketById.get(node.id);
        const active = node.id === activeMarketId;
        const size = Math.round(48 + ((node.radius - 0.48) / 0.57) * 38);

        return (
          <div
            key={node.id}
            data-testid="gravity-fallback-bubble"
            className={cx(bubbleStyle, active ? activeBubbleStyle : undefined)}
            style={{
              borderColor: node.haloColor,
              boxShadow: `inset 0 0 24px ${node.haloColor}22, 0 0 ${active ? 34 : 20}px ${node.haloColor}44`,
              height: size,
              left: `${clampPercent(50 + (node.seedPosition[0] / 4.25) * 42)}%`,
              top: `${clampPercent(50 - (node.seedPosition[1] / 2.35) * 36)}%`,
              width: size,
            }}
          >
            <MarketLogo
              imageUrl={market?.imageUrl ?? node.imageUrl}
              name={market?.name ?? node.name}
              size={logoSize(node.radius)}
              symbol={market?.symbol ?? node.symbol}
            />
            <span className={labelStyle}>{market?.symbol ?? node.symbol}</span>
          </div>
        );
      })}
    </div>
  );
}
