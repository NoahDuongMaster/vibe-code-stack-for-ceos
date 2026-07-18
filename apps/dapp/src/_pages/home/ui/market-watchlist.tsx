import {
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { css, cx } from '@/styled-system/css';

type TMarketWatchlistProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

export function MarketWatchlist({
  activeMarketId,
  markets,
  onActiveMarketChange,
}: TMarketWatchlistProps) {
  return (
    <section
      aria-label="Market watch"
      className={css({
        minH: 0,
        bgColor: 'carbon',
        borderWidth: '1px',
        borderColor: 'bone/12',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: '4',
          py: '3',
          borderBottomWidth: '1px',
          borderColor: 'bone/12',
          fontFamily: 'mono',
          fontSize: '2xs',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        })}
      >
        <span>Market watch</span>
        <span className={css({ color: 'toxic' })}>{markets.length} assets</span>
      </div>
      <ol className={css({ listStyle: 'none' })}>
        {markets.map((market, index) => {
          const active = market.id === activeMarketId;
          const positive = (market.priceChangePercentage24h ?? 0) > 0;

          return (
            <li key={market.id}>
              <button
                type="button"
                aria-label={`Select ${market.name}`}
                aria-pressed={active}
                className={cx(
                  css({
                    display: 'grid',
                    gridTemplateColumns: '2.25rem minmax(0, 1fr) auto',
                    alignItems: 'center',
                    w: 'full',
                    px: '4',
                    py: '3',
                    color: 'bone',
                    borderBottomWidth: '1px',
                    borderColor: 'bone/8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    _hover: { bgColor: 'bone/4' },
                    _focusVisible: {
                      outline: '2px solid token(colors.toxic)',
                      outlineOffset: '-2px',
                    },
                  }),
                  active ? css({ bgColor: 'toxic/8' }) : undefined,
                )}
                onFocus={() => onActiveMarketChange(market.id)}
                onMouseEnter={() => onActiveMarketChange(market.id)}
                onClick={() => onActiveMarketChange(market.id)}
              >
                <span className={css({ color: 'bone/40', fontFamily: 'mono' })}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong className={css({ display: 'block' })}>
                    {market.symbol}
                  </strong>
                  <span className={css({ color: 'bone/48', fontSize: 'xs' })}>
                    {market.name}
                  </span>
                </span>
                <span
                  className={css({ fontFamily: 'mono', textAlign: 'right' })}
                >
                  <span className={css({ display: 'block' })}>
                    {formatMarketPrice(market.currentPrice)}
                  </span>
                  <span className={css({ color: positive ? 'toxic' : 'rekt' })}>
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
