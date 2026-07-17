import {
  formatCompactUsd,
  formatMarketChange,
} from '@/_pages/home/model/market.formatters';
import type { TMarketSummary } from '@/_pages/home/model/market.schema';
import { css } from '@/styled-system/css';
import { grid } from '@/styled-system/patterns';

type TMarketMetricsProps = {
  summary?: TMarketSummary;
};

const metricsGridStyle = grid({
  columns: { base: 1, sm: 2, xl: 4 },
  gap: '3',
});

const metricCardStyle = css({
  position: 'relative',
  minH: '32',
  p: '5',
  overflow: 'hidden',
  bgColor: 'rgba(13, 25, 35, 0.78)',
  borderWidth: '1px',
  borderColor: 'rgba(145, 169, 180, 0.16)',
  rounded: 'xl',
  _before: {
    content: '""',
    position: 'absolute',
    insetInlineStart: 0,
    top: '5',
    h: '8',
    w: '2px',
    bgColor: '#67e8f9',
    boxShadow: '0 0 16px rgba(103, 232, 249, 0.75)',
  },
});

const metricLabelStyle = css({
  color: '#91a9b4',
  fontFamily: 'mono',
  fontSize: 'xs',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

const metricValueStyle = css({
  mt: '4',
  fontSize: { base: '2xl', md: '3xl' },
  fontWeight: 'bold',
  letterSpacing: '-0.04em',
  lineHeight: '1',
});

export function MarketMetrics({ summary }: TMarketMetricsProps) {
  const strongestGainer = summary?.strongestGainer;

  return (
    <section aria-label="Selected market metrics" className={metricsGridStyle}>
      <article className={metricCardStyle}>
        <p className={metricLabelStyle}>Selected market cap</p>
        <p className={metricValueStyle}>
          {formatCompactUsd(summary?.selectedMarketCap)}
        </p>
      </article>
      <article className={metricCardStyle}>
        <p className={metricLabelStyle}>Selected 24h volume</p>
        <p className={metricValueStyle}>
          {formatCompactUsd(summary?.selectedVolume24h)}
        </p>
      </article>
      <article className={metricCardStyle}>
        <p className={metricLabelStyle}>Strongest gainer</p>
        <p className={metricValueStyle}>
          {strongestGainer
            ? `${strongestGainer.symbol} ${formatMarketChange(strongestGainer.priceChangePercentage24h)}`
            : '—'}
        </p>
      </article>
      <article className={metricCardStyle}>
        <p className={metricLabelStyle}>Gain / loss breadth</p>
        <p className={metricValueStyle}>
          {summary
            ? `${summary.gainerCount} gainers / ${summary.loserCount} losers`
            : '—'}
        </p>
      </article>
    </section>
  );
}
