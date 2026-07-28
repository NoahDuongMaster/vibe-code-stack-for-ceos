import { Progress } from '@ark-ui/react/progress';
import { Tabs } from '@ark-ui/react/tabs';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  DatabaseZap,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  formatCompactUsd,
  formatMarketChange,
  formatMarketPrice,
  formatMarketTimestamp,
} from '@/screens/dashboard/model/market.formatters';
import { createMarketSummary } from '@/screens/dashboard/model/market.mapper';
import type {
  TMarket,
  TMarketsSnapshot,
} from '@/screens/dashboard/model/market.schema';
import { useMarkets } from '@/screens/dashboard/model/use-markets';
import { MarketLogo } from '@/screens/dashboard/ui/market-logo';
import { Button } from '@/shared/ui';
import { css, cx } from '@/styled-system/css';
import { flex, grid } from '@/styled-system/patterns';

const cardCss = css({
  bg: 'card',
  borderColor: 'border',
  borderWidth: '1px',
  rounded: 'xl',
});

const tableCellCss = css({
  px: { base: '3', md: '5' },
  py: '4',
  textAlign: 'left',
  whiteSpace: 'nowrap',
});

const DASHBOARD_TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Live assets', value: 'assets' },
] as const;

function MetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className={cx(cardCss, css({ p: '5' }))}>
      <div className={flex({ justify: 'space-between', align: 'start' })}>
        <div>
          <p
            className={css({
              color: 'muted.foreground',
              fontSize: 'sm',
              fontWeight: 'medium',
            })}
          >
            {label}
          </p>
          <p
            className={css({
              fontSize: { base: '2xl', xl: '3xl' },
              fontWeight: 'bold',
              letterSpacing: 'tight',
              mt: '2',
            })}
          >
            {value}
          </p>
        </div>
        <span
          className={css({
            alignItems: 'center',
            bg: 'secondary',
            color: 'secondary.foreground',
            display: 'inline-flex',
            h: '10',
            justifyContent: 'center',
            rounded: 'lg',
            w: '10',
          })}
          aria-hidden="true"
        >
          <Icon size={19} />
        </span>
      </div>
      <p
        className={css({ color: 'muted.foreground', fontSize: 'xs', mt: '4' })}
      >
        {detail}
      </p>
    </article>
  );
}

function DashboardLoading() {
  return (
    <div className={grid({ columns: { base: 1, sm: 2, xl: 4 }, gap: '4' })}>
      {['cap', 'volume', 'gainers', 'feed'].map((key) => (
        <div
          key={key}
          className={cx(
            cardCss,
            css({
              animation: 'fadeIn 1.5s ease-in-out infinite alternate',
              h: '36',
              bg: 'muted',
            }),
          )}
        />
      ))}
    </div>
  );
}

function DashboardError({
  isRefetching,
  onRetry,
}: {
  isRefetching: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      className={cx(
        cardCss,
        flex({ direction: 'column', align: 'center', gap: '4' }),
        css({ p: { base: '8', md: '12' }, textAlign: 'center' }),
      )}
      role="alert"
    >
      <DatabaseZap
        className={css({ color: 'destructive' })}
        size={30}
        aria-hidden="true"
      />
      <div>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>
          Market feed unavailable
        </h2>
        <p
          className={css({
            color: 'muted.foreground',
            fontSize: 'sm',
            mt: '1',
          })}
        >
          The dashboard could not load data through API Gateway. Try again in a
          moment.
        </p>
      </div>
      <Button onClick={onRetry} disabled={isRefetching} variant="secondary">
        <RefreshCw size={16} aria-hidden="true" />
        {isRefetching ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}

const getMarketShare = (
  marketCap: number | undefined,
  total: number,
): number => (total > 0 ? ((marketCap ?? 0) / total) * 100 : 0);

function MarketOverview({ snapshot }: { snapshot: TMarketsSnapshot }) {
  const summary = createMarketSummary(snapshot);

  return (
    <div className={flex({ direction: 'column', gap: '5' })}>
      <div className={grid({ columns: { base: 1, sm: 2, xl: 4 }, gap: '4' })}>
        <MetricCard
          detail={`${snapshot.markets.length} tracked assets`}
          icon={CircleDollarSign}
          label="Tracked market cap"
          value={formatCompactUsd(summary.totalMarketCap)}
        />
        <MetricCard
          detail="Combined rolling 24-hour volume"
          icon={BarChart3}
          label="24h volume"
          value={formatCompactUsd(summary.totalVolume24h)}
        />
        <MetricCard
          detail={`${summary.loserCount} assets down over 24 hours`}
          icon={TrendingUp}
          label="Assets gaining"
          value={String(summary.gainerCount)}
        />
        <MetricCard
          detail="admin-rpc → trading-rpc"
          icon={Activity}
          label="Data pipeline"
          value="Live"
        />
      </div>

      <section className={cx(cardCss, css({ p: { base: '4', md: '6' } }))}>
        <div
          className={flex({
            align: { base: 'start', sm: 'center' },
            direction: { base: 'column', sm: 'row' },
            justify: 'space-between',
            gap: '2',
          })}
        >
          <div>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>
              Tracked market share
            </h2>
            <p className={css({ color: 'muted.foreground', fontSize: 'sm' })}>
              Share of the combined market cap in this admin watchlist.
            </p>
          </div>
          <span
            className={css({
              bg: 'secondary',
              color: 'secondary.foreground',
              fontSize: 'xs',
              fontWeight: 'semibold',
              px: '3',
              py: '1.5',
              rounded: 'full',
              textTransform: 'uppercase',
            })}
          >
            Quote: {snapshot.vsCurrency}
          </span>
        </div>

        <div className={flex({ direction: 'column', gap: '5', mt: '6' })}>
          {snapshot.markets.slice(0, 5).map((market) => {
            const share = getMarketShare(
              market.marketCap,
              summary.totalMarketCap,
            );
            return (
              <Progress.Root key={market.id} value={share} min={0} max={100}>
                <div
                  className={flex({
                    align: 'center',
                    justify: 'space-between',
                    gap: '4',
                    mb: '2',
                  })}
                >
                  <Progress.Label
                    className={css({ fontSize: 'sm', fontWeight: 'medium' })}
                  >
                    {market.name}
                  </Progress.Label>
                  <Progress.ValueText
                    className={css({
                      color: 'muted.foreground',
                      fontFamily: 'mono',
                      fontSize: 'xs',
                    })}
                  >
                    {share.toFixed(1)}%
                  </Progress.ValueText>
                </div>
                <Progress.Track
                  className={css({
                    bg: 'muted',
                    h: '2',
                    overflow: 'hidden',
                    rounded: 'full',
                  })}
                >
                  <Progress.Range
                    className={css({
                      bg: 'primary',
                      h: 'full',
                      rounded: 'full',
                    })}
                  />
                </Progress.Track>
              </Progress.Root>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ChangeValue({ market }: { market: TMarket }) {
  const value = market.priceChangePercentage24h;
  if (value === undefined) {
    return (
      <span className={css({ color: 'muted.foreground' })}>
        {formatMarketChange(value)}
      </span>
    );
  }

  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <span
      className={flex({ align: 'center', gap: '1', fontWeight: 'semibold' })}
      style={{
        color: positive ? 'var(--colors-success)' : 'var(--colors-destructive)',
      }}
    >
      <Icon size={14} aria-hidden="true" />
      {formatMarketChange(value)}
    </span>
  );
}

function MarketsTable({ snapshot }: { snapshot: TMarketsSnapshot }) {
  return (
    <section className={cx(cardCss, css({ overflow: 'hidden' }))}>
      <div className={css({ overflowX: 'auto' })}>
        <table
          className={css({
            borderCollapse: 'collapse',
            minW: '760px',
            w: 'full',
          })}
        >
          <caption className={css({ srOnly: true })}>
            Live crypto market information from admin RPC
          </caption>
          <thead className={css({ bg: 'secondary' })}>
            <tr>
              {[
                'Asset',
                'Price',
                '24h change',
                'Market cap',
                '24h volume',
                'Updated',
              ].map((heading) => (
                <th
                  key={heading}
                  className={cx(
                    tableCellCss,
                    css({
                      color: 'muted.foreground',
                      fontSize: 'xs',
                      fontWeight: 'semibold',
                      letterSpacing: 'wider',
                      textTransform: 'uppercase',
                    }),
                  )}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshot.markets.map((market) => (
              <tr
                key={market.id}
                className={css({
                  borderTopColor: 'border',
                  borderTopWidth: '1px',
                  _hover: { bg: 'accent' },
                })}
              >
                <td className={tableCellCss}>
                  <div className={flex({ align: 'center', gap: '3' })}>
                    <MarketLogo
                      imageUrl={market.imageUrl}
                      name={market.name}
                      symbol={market.symbol}
                    />
                    <span>
                      <strong
                        className={css({ display: 'block', fontSize: 'sm' })}
                      >
                        {market.name}
                      </strong>
                      <span
                        className={css({
                          color: 'muted.foreground',
                          fontSize: 'xs',
                          textTransform: 'uppercase',
                        })}
                      >
                        {market.symbol} · #{market.marketCapRank ?? '—'}
                      </span>
                    </span>
                  </div>
                </td>
                <td
                  className={cx(
                    tableCellCss,
                    css({ fontFamily: 'mono', fontSize: 'sm' }),
                  )}
                >
                  {formatMarketPrice(market.currentPrice)}
                </td>
                <td className={cx(tableCellCss, css({ fontSize: 'sm' }))}>
                  <ChangeValue market={market} />
                </td>
                <td
                  className={cx(
                    tableCellCss,
                    css({ fontFamily: 'mono', fontSize: 'sm' }),
                  )}
                >
                  {formatCompactUsd(market.marketCap)}
                </td>
                <td
                  className={cx(
                    tableCellCss,
                    css({ fontFamily: 'mono', fontSize: 'sm' }),
                  )}
                >
                  {formatCompactUsd(market.totalVolume)}
                </td>
                <td
                  className={cx(
                    tableCellCss,
                    css({ color: 'muted.foreground', fontSize: 'xs' }),
                  )}
                >
                  {formatMarketTimestamp(market.lastUpdated)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MarketDashboard() {
  const { data, isError, isFetching, isLoading, refetch } = useMarkets();

  if (isLoading) return <DashboardLoading />;
  if (isError || !data) {
    return (
      <DashboardError
        isRefetching={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <Tabs.Root defaultValue="overview" lazyMount>
      <div
        className={flex({
          align: { base: 'stretch', sm: 'center' },
          direction: { base: 'column', sm: 'row' },
          justify: 'space-between',
          gap: '3',
          mb: '5',
        })}
      >
        <Tabs.List
          className={css({
            alignItems: 'center',
            bg: 'muted',
            display: 'inline-flex',
            p: '1',
            rounded: 'lg',
            w: { base: 'full', sm: 'fit-content' },
          })}
        >
          {DASHBOARD_TABS.map(({ label, value }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={css({
                color: 'muted.foreground',
                cursor: 'pointer',
                flex: { base: '1', sm: 'initial' },
                fontSize: 'sm',
                fontWeight: 'semibold',
                px: '4',
                py: '2',
                rounded: 'md',
                _focusVisible: {
                  outline: '2px solid',
                  outlineColor: 'ring',
                  outlineOffset: '2px',
                },
                _selected: {
                  bg: 'card',
                  color: 'foreground',
                  shadow: 'sm',
                },
              })}
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Button
          onClick={() => void refetch()}
          disabled={isFetching}
          size="sm"
          variant="ghost"
        >
          <RefreshCw
            className={css({ animation: isFetching ? 'spin' : undefined })}
            size={15}
            aria-hidden="true"
          />
          {isFetching ? 'Refreshing…' : 'Refresh data'}
        </Button>
      </div>

      <Tabs.Content value="overview">
        <MarketOverview snapshot={data} />
      </Tabs.Content>
      <Tabs.Content value="assets">
        <MarketsTable snapshot={data} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
