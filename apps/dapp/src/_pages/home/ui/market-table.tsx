import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import {
  formatCompactUsd,
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { css, cx } from '@/styled-system/css';
import { flex, grid } from '@/styled-system/patterns';

type TMarketTableProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

const visuallyHiddenStyle = css({
  position: 'absolute',
  w: '1px',
  h: '1px',
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
});

const assetButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3',
  textAlign: 'left',
  cursor: 'pointer',
  rounded: 'md',
  _focusVisible: {
    outline: '2px solid #67e8f9',
    outlineOffset: '4px',
  },
});

const tokenStyle = css({
  display: 'grid',
  placeItems: 'center',
  w: '9',
  h: '9',
  flexShrink: 0,
  color: '#071018',
  bgColor: '#67e8f9',
  rounded: 'full',
  fontFamily: 'mono',
  fontSize: '2xs',
  fontWeight: 'black',
  boxShadow: '0 0 24px rgba(103, 232, 249, 0.2)',
});

const changeTone = (change: number | undefined): string => {
  if (change === undefined || change === 0) return '#91a9b4';
  return change > 0 ? '#67e8f9' : '#fb7185';
};

function MarketChange({ value }: { value: number | undefined }) {
  const Icon =
    value === undefined || value === 0
      ? Minus
      : value > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <span
      className={flex({ align: 'center', justify: 'flex-end', gap: '1' })}
      style={{ color: changeTone(value) }}
    >
      <Icon aria-hidden="true" size={15} />
      {formatMarketChange(value)}
    </span>
  );
}

function AssetButton({
  market,
  onActiveMarketChange,
}: {
  market: TMarket;
  onActiveMarketChange: (marketId: TMarket['id']) => void;
}) {
  return (
    <button
      type="button"
      className={assetButtonStyle}
      aria-label={`Highlight ${market.name} in 3D`}
      onFocus={() => onActiveMarketChange(market.id)}
      onMouseEnter={() => onActiveMarketChange(market.id)}
    >
      <span className={tokenStyle}>{market.symbol.slice(0, 2)}</span>
      <span>
        <strong className={css({ display: 'block' })}>{market.name}</strong>
        <span
          className={css({
            color: '#91a9b4',
            fontFamily: 'mono',
            fontSize: 'xs',
          })}
        >
          {market.symbol}
        </span>
      </span>
    </button>
  );
}

export function MarketTable({
  activeMarketId,
  markets,
  onActiveMarketChange,
}: TMarketTableProps) {
  return (
    <section aria-labelledby="market-list-heading">
      <div
        className={flex({
          align: 'end',
          justify: 'space-between',
          gap: '4',
          mb: '4',
        })}
      >
        <div>
          <p
            className={css({
              color: '#a78bfa',
              fontFamily: 'mono',
              fontSize: 'xs',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            })}
          >
            Fixed watchlist
          </p>
          <h2
            id="market-list-heading"
            className={css({ mt: '1', fontSize: '2xl', fontWeight: 'bold' })}
          >
            Market matrix
          </h2>
        </div>
        <p className={css({ color: '#91a9b4', fontSize: 'sm' })}>
          Focus an asset to highlight its 3D token.
        </p>
      </div>

      <div
        className={css({
          display: { base: 'none', md: 'block' },
          overflowX: 'auto',
          bgColor: 'rgba(13, 25, 35, 0.72)',
          borderWidth: '1px',
          borderColor: 'rgba(145, 169, 180, 0.16)',
          rounded: 'xl',
        })}
      >
        <table className={css({ w: 'full', borderCollapse: 'collapse' })}>
          <thead>
            <tr>
              {['Asset', 'Price', '24h', 'Market cap', 'Volume'].map(
                (heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className={css({
                      px: '5',
                      py: '4',
                      color: '#91a9b4',
                      borderBottomWidth: '1px',
                      borderColor: 'rgba(145, 169, 180, 0.14)',
                      fontFamily: 'mono',
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      letterSpacing: '0.08em',
                      textAlign: heading === 'Asset' ? 'left' : 'right',
                      textTransform: 'uppercase',
                    })}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr
                key={market.id}
                className={css({
                  bgColor:
                    activeMarketId === market.id
                      ? 'rgba(103, 232, 249, 0.055)'
                      : 'transparent',
                  _hover: { bgColor: 'rgba(103, 232, 249, 0.035)' },
                })}
              >
                <th
                  scope="row"
                  className={css({
                    px: '5',
                    py: '4',
                    borderBottomWidth: '1px',
                    borderColor: 'rgba(145, 169, 180, 0.1)',
                    fontWeight: 'normal',
                    textAlign: 'left',
                  })}
                >
                  <AssetButton
                    market={market}
                    onActiveMarketChange={onActiveMarketChange}
                  />
                </th>
                <td className={cx(cellStyle, numericCellStyle)}>
                  {formatMarketPrice(market.currentPrice)}
                </td>
                <td className={cx(cellStyle, numericCellStyle)}>
                  <MarketChange value={market.priceChangePercentage24h} />
                </td>
                <td className={cx(cellStyle, numericCellStyle)}>
                  {formatCompactUsd(market.marketCap)}
                </td>
                <td className={cx(cellStyle, numericCellStyle)}>
                  {formatCompactUsd(market.totalVolume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={grid({
          display: { base: 'grid', md: 'none' },
          columns: 1,
          gap: '3',
        })}
      >
        {markets.map((market) => (
          <article
            key={market.id}
            className={css({
              p: '4',
              bgColor:
                activeMarketId === market.id
                  ? 'rgba(103, 232, 249, 0.08)'
                  : 'rgba(13, 25, 35, 0.72)',
              borderWidth: '1px',
              borderColor:
                activeMarketId === market.id
                  ? 'rgba(103, 232, 249, 0.4)'
                  : 'rgba(145, 169, 180, 0.16)',
              rounded: 'xl',
            })}
          >
            <div
              className={flex({ align: 'center', justify: 'space-between' })}
            >
              <AssetButton
                market={market}
                onActiveMarketChange={onActiveMarketChange}
              />
              <MarketChange value={market.priceChangePercentage24h} />
            </div>
            <dl className={grid({ columns: 3, gap: '3', mt: '5' })}>
              {[
                ['Price', formatMarketPrice(market.currentPrice)],
                ['Cap', formatCompactUsd(market.marketCap)],
                ['Volume', formatCompactUsd(market.totalVolume)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className={css({ color: '#91a9b4', fontSize: 'xs' })}>
                    {label}
                  </dt>
                  <dd
                    className={css({
                      mt: '1',
                      fontFamily: 'mono',
                      fontSize: 'sm',
                    })}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <span className={visuallyHiddenStyle} aria-live="polite">
        {activeMarketId ? `${activeMarketId} highlighted in 3D` : ''}
      </span>
    </section>
  );
}

const cellStyle = css({
  px: '5',
  py: '4',
  borderBottomWidth: '1px',
  borderColor: 'rgba(145, 169, 180, 0.1)',
});

const numericCellStyle = css({
  fontFamily: 'mono',
  fontSize: 'sm',
  textAlign: 'right',
  whiteSpace: 'nowrap',
});
