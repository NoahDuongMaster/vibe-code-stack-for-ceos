import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import {
  formatCompactUsd,
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { MarketLogo } from '@/_pages/home/ui/market-logo';
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
  minW: 0,
  gap: '3',
  color: 'bone',
  textAlign: 'left',
  cursor: 'pointer',
  _focusVisible: {
    outline: '2px solid token(colors.toxic)',
    outlineOffset: '3px',
  },
});

const activeTokenStyle = css({
  borderColor: 'toxic',
  boxShadow:
    '0 0 0 2px rgba(199, 255, 47, 0.24), 0 0 18px rgba(199, 255, 47, 0.2)',
});

const cellStyle = css({
  px: '4',
  py: '3',
  borderBottomWidth: '1px',
  borderColor: 'bone/8',
});

const numericCellStyle = css({
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: 'xs',
  textAlign: 'right',
  whiteSpace: 'nowrap',
});

const changeTone = (change: number | undefined): string => {
  if (change === undefined || change === 0) return '#8B5CF6';
  return change > 0 ? '#C7FF2F' : '#FF3B5C';
};

const formatRank = (rank: number | undefined): string =>
  rank === undefined ? '—' : String(rank).padStart(2, '0');

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
      <Icon aria-hidden="true" size={14} />
      {formatMarketChange(value)}
    </span>
  );
}

function AssetButton({
  active,
  market,
  onActiveMarketChange,
}: {
  active: boolean;
  market: TMarket;
  onActiveMarketChange: (marketId: TMarket['id']) => void;
}) {
  return (
    <button
      type="button"
      className={assetButtonStyle}
      aria-label={`Highlight ${market.name} in 3D`}
      aria-pressed={active}
      onFocus={() => onActiveMarketChange(market.id)}
      onMouseEnter={() => onActiveMarketChange(market.id)}
      onClick={() => onActiveMarketChange(market.id)}
    >
      <MarketLogo
        className={active ? activeTokenStyle : undefined}
        imageUrl={market.imageUrl}
        name={market.name}
        size={32}
        symbol={market.symbol}
      />
      <span className={css({ minW: 0 })}>
        <strong
          className={css({
            display: 'block',
            overflow: 'hidden',
            fontSize: 'sm',
            fontWeight: '600',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          })}
        >
          {market.name}
        </strong>
        <span
          className={css({
            display: 'block',
            mt: '0.5',
            color: 'bone/62',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
            fontSize: '2xs',
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
          mb: '3',
        })}
      >
        <div>
          <p
            className={css({
              color: 'plasma',
              fontFamily: 'var(--font-mono), ui-monospace, monospace',
              fontSize: '2xs',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            })}
          >
            Spot snapshot / USD
          </p>
          <h2
            id="market-list-heading"
            className={css({
              mt: '1',
              fontFamily:
                'var(--font-display), ui-sans-serif, system-ui, sans-serif',
              fontSize: { base: 'xl', md: '2xl' },
              fontWeight: '600',
              letterSpacing: '-0.05em',
            })}
          >
            Market matrix
          </h2>
        </div>
        <p
          className={css({
            display: { base: 'none', md: 'block' },
            color: 'bone/62',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
            fontSize: '2xs',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          })}
        >
          {markets.length} assets / live selection
        </p>
      </div>

      <div
        className={css({
          display: { base: 'none', md: 'block' },
          overflowX: 'auto',
          overscrollBehaviorX: 'contain',
          scrollbarGutter: 'stable',
          bgColor: 'carbon',
          borderWidth: '1px',
          borderColor: 'bone/12',
          clipPath:
            'polygon(0 0, calc(100% - 0.9rem) 0, 100% 0.9rem, 100% 100%, 0 100%)',
        })}
      >
        <table
          className={css({
            w: 'full',
            minW: '52rem',
            borderCollapse: 'collapse',
          })}
        >
          <thead>
            <tr>
              {['Rank', 'Asset', 'Price', '24h', 'Market cap', 'Volume'].map(
                (heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className={css({
                      px: '4',
                      py: '3',
                      color: 'bone/62',
                      borderBottomWidth: '1px',
                      borderColor: 'bone/12',
                      fontFamily: 'var(--font-mono), ui-monospace, monospace',
                      fontSize: '2xs',
                      fontWeight: '500',
                      letterSpacing: '0.12em',
                      textAlign:
                        heading === 'Asset' || heading === 'Rank'
                          ? 'left'
                          : 'right',
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
            {markets.map((market) => {
              const active = activeMarketId === market.id;

              return (
                <tr
                  key={market.id}
                  className={css({
                    bgColor: active ? 'toxic/5' : 'transparent',
                    boxShadow: active ? 'inset 2px 0 0 #C7FF2F' : 'none',
                    _hover: { bgColor: active ? 'toxic/7' : 'bone/3' },
                  })}
                >
                  <td
                    className={cx(
                      cellStyle,
                      css({
                        w: '16',
                        color: active ? 'toxic' : 'bone/62',
                        fontFamily: 'var(--font-mono), ui-monospace, monospace',
                        fontSize: '2xs',
                      }),
                    )}
                  >
                    {formatRank(market.marketCapRank)}
                  </td>
                  <th
                    scope="row"
                    className={cx(cellStyle, css({ fontWeight: 'normal' }))}
                  >
                    <AssetButton
                      active={active}
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className={grid({
          display: { base: 'grid', md: 'none' },
          columns: 1,
          gap: '2',
        })}
      >
        {markets.map((market) => {
          const active = activeMarketId === market.id;

          return (
            <article
              key={market.id}
              className={css({
                p: '3',
                overflow: 'clip',
                bgColor: active ? 'toxic/5' : 'carbon',
                borderWidth: '1px',
                borderColor: active ? 'toxic/62' : 'bone/12',
                boxShadow: active ? 'inset 2px 0 0 #C7FF2F' : 'none',
                clipPath:
                  'polygon(0 0, calc(100% - 0.7rem) 0, 100% 0.7rem, 100% 100%, 0 100%)',
              })}
            >
              <div
                className={flex({
                  align: 'center',
                  justify: 'space-between',
                  gap: '3',
                })}
              >
                <div className={flex({ align: 'center', gap: '3', minW: 0 })}>
                  <span
                    className={css({
                      color: active ? 'toxic' : 'bone/62',
                      fontFamily: 'var(--font-mono), ui-monospace, monospace',
                      fontSize: '2xs',
                    })}
                  >
                    {formatRank(market.marketCapRank)}
                  </span>
                  <AssetButton
                    active={active}
                    market={market}
                    onActiveMarketChange={onActiveMarketChange}
                  />
                </div>
                <MarketChange value={market.priceChangePercentage24h} />
              </div>
              <dl
                className={grid({
                  columns: 3,
                  gap: '2',
                  mt: '3',
                  pt: '3',
                  borderTopWidth: '1px',
                  borderColor: 'bone/8',
                })}
              >
                {[
                  ['Price', formatMarketPrice(market.currentPrice)],
                  ['Cap', formatCompactUsd(market.marketCap)],
                  ['Volume', formatCompactUsd(market.totalVolume)],
                ].map(([label, value]) => (
                  <div key={label} className={css({ minW: 0 })}>
                    <dt
                      className={css({
                        color: 'bone/62',
                        fontFamily: 'var(--font-mono), ui-monospace, monospace',
                        fontSize: '2xs',
                        textTransform: 'uppercase',
                      })}
                    >
                      {label}
                    </dt>
                    <dd
                      className={css({
                        mt: '1',
                        overflow: 'hidden',
                        fontFamily: 'var(--font-mono), ui-monospace, monospace',
                        fontSize: 'xs',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      })}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>
      <span className={visuallyHiddenStyle} aria-live="polite">
        {activeMarketId ? `${activeMarketId} highlighted in 3D` : ''}
      </span>
    </section>
  );
}
