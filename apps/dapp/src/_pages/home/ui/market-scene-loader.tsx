import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketSceneNode } from '@/_pages/home/model/market-scene.mapper';
import { css } from '@/styled-system/css';

type TMarketSceneLoaderProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  nodes: TMarketSceneNode[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

export function MarketSceneLoader({
  activeMarketId,
  markets,
}: TMarketSceneLoaderProps) {
  return (
    <div
      aria-hidden="true"
      className={css({
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        minH: { base: '80', lg: '112' },
        overflow: 'hidden',
        bgColor: 'rgba(7, 16, 24, 0.72)',
        borderWidth: '1px',
        borderColor: 'rgba(103, 232, 249, 0.18)',
        rounded: '2xl',
      })}
    >
      <div
        className={css({
          w: '28',
          h: '28',
          bgColor: '#a78bfa',
          rounded: 'full',
          boxShadow:
            '0 0 24px rgba(167, 139, 250, 0.75), 0 0 96px rgba(103, 232, 249, 0.35)',
        })}
      />
      <p
        className={css({
          position: 'absolute',
          bottom: '5',
          color: '#91a9b4',
          fontFamily: 'mono',
          fontSize: 'xs',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        })}
      >
        {markets.length > 0
          ? `${activeMarketId ?? markets[0]?.id} / topology ready`
          : 'Awaiting market signal'}
      </p>
    </div>
  );
}
