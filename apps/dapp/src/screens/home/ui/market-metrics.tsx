import {
  formatCompactUsd,
  formatMarketChange,
} from '@/screens/home/model/market.formatters';
import type { TMarketSummary } from '@/screens/home/model/market.schema';
import { css } from '@/styled-system/css';
import { grid } from '@/styled-system/patterns';

type TMarketMetricsProps = {
  summary?: TMarketSummary;
};

const metricsGridStyle = grid({
  columns: { base: 2, md: 4 },
  gap: '0',
  overflow: 'clip',
  color: 'bone',
  bgColor: 'carbon',
  borderWidth: '1px',
  borderColor: 'bone/12',
  clipPath:
    'polygon(0 0, calc(100% - 0.75rem) 0, 100% 0.75rem, 100% 100%, 0 100%)',
});

const metricCellStyle = css({
  minW: 0,
  minH: { base: '22', md: '24' },
  px: { base: '3', md: '4' },
  py: '3',
  borderInlineEndWidth: '1px',
  borderBottomWidth: { base: '1px', md: '0' },
  borderColor: 'bone/10',
  '&:nth-of-type(2n)': {
    borderInlineEndWidth: { base: '0', md: '1px' },
  },
  '&:nth-of-type(n + 3)': {
    borderBottomWidth: '0',
  },
  '&:last-child': {
    borderInlineEndWidth: '0',
  },
});

const metricLabelStyle = css({
  color: 'bone/62',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
});

const metricValueStyle = css({
  mt: '2',
  overflow: 'hidden',
  color: 'bone',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: { base: 'md', md: 'lg' },
  fontWeight: '600',
  letterSpacing: '-0.03em',
  lineHeight: '1.1',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export function MarketMetrics({ summary }: TMarketMetricsProps) {
  const strongestGainer = summary?.strongestGainer;

  return (
    <section
      aria-labelledby="market-pulse-heading"
      className={metricsGridStyle}
    >
      <h2 id="market-pulse-heading" className={css({ srOnly: true })}>
        Market pulse
      </h2>
      <article className={metricCellStyle}>
        <p className={metricLabelStyle}>Selected cap</p>
        <p className={metricValueStyle}>
          {formatCompactUsd(summary?.selectedMarketCap)}
        </p>
      </article>
      <article className={metricCellStyle}>
        <p className={metricLabelStyle}>24h volume</p>
        <p className={metricValueStyle}>
          {formatCompactUsd(summary?.selectedVolume24h)}
        </p>
      </article>
      <article className={metricCellStyle}>
        <p className={metricLabelStyle}>Momentum leader</p>
        <p className={metricValueStyle}>
          {strongestGainer
            ? `${strongestGainer.symbol} ${formatMarketChange(strongestGainer.priceChangePercentage24h)}`
            : '—'}
        </p>
      </article>
      <article className={metricCellStyle}>
        <p className={metricLabelStyle}>Breadth</p>
        <p className={metricValueStyle}>
          {summary
            ? `${summary.gainerCount} up / ${summary.loserCount} down`
            : '—'}
        </p>
      </article>
    </section>
  );
}
