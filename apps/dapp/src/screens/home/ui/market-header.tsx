import { Activity, RefreshCw } from 'lucide-react';
import {
  formatMarketChange,
  formatMarketPrice,
} from '@/screens/home/model/market.formatters';
import type { TMarket } from '@/screens/home/model/market.schema';
import { css } from '@/styled-system/css';

type TMarketHeaderStatus = 'live' | 'loading' | 'stale' | 'updating';

type TMarketHeaderProps = {
  lastUpdatedAt?: number;
  markets: TMarket[];
  onRefresh: () => void;
  status: TMarketHeaderStatus;
};

const STATUS_LABELS: Record<TMarketHeaderStatus, string> = {
  live: 'Live',
  loading: 'Connecting',
  stale: 'Data may be stale',
  updating: 'Updating',
};

const changeTone = (change: number | undefined): string =>
  change === undefined || change === 0
    ? '#8B5CF6'
    : change > 0
      ? '#C7FF2F'
      : '#FF3B5C';

const statusTone = (status: TMarketHeaderStatus): string => {
  if (status === 'stale') return '#FF3B5C';
  if (status === 'live') return '#C7FF2F';
  return '#8B5CF6';
};

const headerStyle = css({
  display: 'grid',
  gridTemplateColumns: { base: '1fr auto', lg: 'auto minmax(0, 1fr) auto' },
  alignItems: 'stretch',
  minH: '20',
  overflow: 'clip',
  color: 'bone',
  bgColor: 'carbon',
  borderWidth: '1px',
  borderColor: 'bone/12',
  clipPath:
    'polygon(0 0, calc(100% - 0.75rem) 0, 100% 0.75rem, 100% 100%, 0 100%)',
});

const identityStyle = css({
  px: '4',
  py: '2.5',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minW: { lg: '15rem' },
  borderInlineEndWidth: { lg: '1px' },
  borderColor: 'bone/12',
});

const kickerStyle = css({
  color: 'bone/62',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
});

const wordmarkStyle = css({
  mt: '0.5',
  fontFamily: 'var(--font-display), ui-sans-serif, system-ui, sans-serif',
  fontSize: { base: 'xl', md: '2xl' },
  fontWeight: '800',
  letterSpacing: '-0.08em',
});

const tapeStyle = css({
  display: { base: 'none', md: 'flex' },
  gridColumn: { md: '1 / -1', lg: 'auto' },
  alignItems: 'stretch',
  minW: 0,
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  listStyle: 'none',
  borderTopWidth: { md: '1px', lg: '0' },
  borderInlineEndWidth: { lg: '1px' },
  borderColor: 'bone/12',
});

const tapeItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  minW: 'max-content',
  px: '4',
  py: '2.5',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: 'xs',
  borderInlineEndWidth: '1px',
  borderColor: 'bone/8',
});

const statusActionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: { base: '2', md: '3' },
  px: { base: '3', md: '4' },
  borderInlineStartWidth: { lg: '0' },
  borderColor: 'bone/12',
});

const statusStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: 'xs',
  textTransform: 'uppercase',
});

const refreshButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  px: '3',
  py: '2',
  minH: '9',
  color: 'bone',
  borderWidth: '1px',
  borderColor: 'bone/18',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: 'xs',
  cursor: 'pointer',
  transition: 'color 140ms ease, border-color 140ms ease',
  _hover: { color: 'toxic', borderColor: 'toxic/70' },
  _focusVisible: {
    outline: '2px solid token(colors.toxic)',
    outlineOffset: '2px',
  },
});

const refreshLabelStyle = css({
  display: { base: 'none', sm: 'inline' },
});

export function MarketHeader({
  lastUpdatedAt,
  markets,
  onRefresh,
  status,
}: TMarketHeaderProps) {
  const isoTimestamp = lastUpdatedAt
    ? new Date(lastUpdatedAt).toISOString()
    : undefined;
  const localTime = isoTimestamp
    ? new Date(isoTimestamp).toLocaleTimeString('en-US')
    : undefined;

  return (
    <header className={headerStyle}>
      <div className={identityStyle}>
        <p className={kickerStyle}>On-chain market terminal / USD</p>
        <h1 className={wordmarkStyle}>{'VIBE//X'}</h1>
      </div>
      {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops list semantics when list-style is none. */}
      <ul aria-label="Market tape" className={tapeStyle} role="list">
        {markets.slice(0, 3).map((market) => (
          <li key={market.id} className={tapeItemStyle}>
            <strong>{market.symbol}</strong>
            <span>{formatMarketPrice(market.currentPrice)}</span>
            <span
              style={{ color: changeTone(market.priceChangePercentage24h) }}
            >
              {formatMarketChange(market.priceChangePercentage24h)}
            </span>
          </li>
        ))}
      </ul>
      <div className={statusActionsStyle}>
        <div
          aria-live="polite"
          className={statusStyle}
          style={{ color: statusTone(status) }}
        >
          <Activity aria-hidden="true" size={14} />
          <span>{STATUS_LABELS[status]}</span>
          {isoTimestamp ? (
            <time dateTime={isoTimestamp}>{localTime}</time>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Refresh market data"
          className={refreshButtonStyle}
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" size={14} />
          <span className={refreshLabelStyle}>Refresh</span>
        </button>
      </div>
    </header>
  );
}
