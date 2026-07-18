import {
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { MarketLogo } from '@/_pages/home/ui/market-logo';
import { css, cx } from '@/styled-system/css';

type TMarketWatchlistProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

type TChangeTone = 'plasma' | 'rekt' | 'toxic';

const getChangeTone = (change: number | undefined): TChangeTone => {
  if (change === undefined || change === 0) return 'plasma';
  return change > 0 ? 'toxic' : 'rekt';
};

const changeToneStyles: Record<TChangeTone, string> = {
  plasma: css({ color: 'plasma' }),
  rekt: css({ color: 'rekt' }),
  toxic: css({ color: 'toxic' }),
};

const watchlistStyle = css({
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  minH: 0,
  overflow: 'clip',
  color: 'bone',
  bgColor: 'carbon',
  borderWidth: '1px',
  borderColor: 'bone/12',
  clipPath:
    'polygon(0 0, calc(100% - 0.75rem) 0, 100% 0.75rem, 100% 100%, 0 100%)',
});

const watchlistHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  px: '4',
  py: { base: '3', xl: '2' },
  borderBottomWidth: '1px',
  borderColor: 'bone/12',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: 'xs',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
});

const watchlistItemsStyle = css({
  display: { base: 'flex', xl: 'grid' },
  gridAutoRows: { xl: 'minmax(3.25rem, 1fr)' },
  gridTemplateRows: { xl: 'repeat(10, minmax(3.25rem, 1fr))' },
  minW: 0,
  m: 0,
  p: 0,
  overflowX: { base: 'auto', xl: 'hidden' },
  overflowY: { base: 'hidden', xl: 'auto' },
  overscrollBehavior: 'contain',
  scrollbarGutter: { xl: 'stable' },
  listStyle: 'none',
});

const watchlistItemStyle = css({
  flex: { base: '0 0 min(17rem, 82vw)', xl: 'none' },
  minW: 0,
  minH: 0,
  borderInlineEndWidth: { base: '1px', xl: '0' },
  borderColor: 'bone/8',
});

const watchlistButtonStyle = css({
  display: 'grid',
  gridTemplateColumns: '2rem minmax(0, 1fr) auto',
  alignItems: 'center',
  w: 'full',
  h: { xl: 'full' },
  minH: { base: '4.7rem', xl: 0 },
  px: '3',
  py: { base: '2.5', xl: '1' },
  color: 'bone',
  borderBottomWidth: { xl: '1px' },
  borderColor: 'bone/8',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background-color 140ms ease, color 140ms ease',
  _hover: { bgColor: 'bone/4' },
  _focusVisible: {
    outline: '2px solid token(colors.toxic)',
    outlineOffset: '-2px',
  },
});

const activeWatchlistButtonStyle = css({
  bgColor: 'toxic/7',
  boxShadow: 'inset 2px 0 0 #C7FF2F',
});

export function MarketWatchlist({
  activeMarketId,
  markets,
  onActiveMarketChange,
}: TMarketWatchlistProps) {
  return (
    <section aria-label="Market watch" className={watchlistStyle}>
      <div className={watchlistHeaderStyle}>
        <span>Market watch</span>
        <span className={css({ color: 'toxic' })}>{markets.length} assets</span>
      </div>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none. */}
      <ol className={watchlistItemsStyle} role="list">
        {markets.map((market) => {
          const active = market.id === activeMarketId;
          const changeTone = getChangeTone(market.priceChangePercentage24h);

          return (
            <li key={market.id} className={watchlistItemStyle}>
              <button
                type="button"
                aria-label={`Select ${market.name}`}
                aria-pressed={active}
                className={cx(
                  watchlistButtonStyle,
                  active ? activeWatchlistButtonStyle : undefined,
                )}
                onFocus={() => onActiveMarketChange(market.id)}
                onMouseEnter={() => onActiveMarketChange(market.id)}
                onClick={() => onActiveMarketChange(market.id)}
              >
                <MarketLogo
                  imageUrl={market.imageUrl}
                  name={market.name}
                  size={32}
                  symbol={market.symbol}
                />
                <span>
                  <strong
                    className={css({
                      display: 'block',
                      fontFamily: 'var(--font-mono), ui-monospace, monospace',
                      fontSize: 'sm',
                      letterSpacing: '0.04em',
                    })}
                  >
                    {market.symbol}
                  </strong>
                  <span
                    className={css({
                      display: 'block',
                      maxW: '24',
                      overflow: 'hidden',
                      color: 'bone/62',
                      fontSize: 'xs',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {market.name}
                  </span>
                </span>
                <span
                  className={css({
                    fontFamily: 'var(--font-mono), ui-monospace, monospace',
                    textAlign: 'right',
                  })}
                >
                  <span className={css({ display: 'block', fontSize: 'xs' })}>
                    {formatMarketPrice(market.currentPrice)}
                  </span>
                  <span
                    className={cx(
                      css({ display: 'block', mt: '0.5', fontSize: '2xs' }),
                      changeToneStyles[changeTone],
                    )}
                    data-tone={changeTone}
                  >
                    {formatMarketChange(market.priceChangePercentage24h)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
