import { Activity, RefreshCw } from 'lucide-react';
import {
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
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

const headerStyle = css({
  display: 'grid',
  gridTemplateColumns: { base: '1fr auto', lg: 'auto minmax(0, 1fr) auto' },
  alignItems: 'stretch',
  color: 'bone',
  bgColor: 'carbon',
  borderWidth: '1px',
  borderColor: 'bone/12',
});

const identityStyle = css({
  px: '4',
  py: '3',
  borderColor: 'bone/12',
});

const kickerStyle = css({
  color: 'bone/42',
  fontFamily: 'mono',
  fontSize: '2xs',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
});

const wordmarkStyle = css({
  mt: '1',
  fontFamily: 'display',
  fontSize: { base: '2xl', md: '3xl' },
  fontWeight: '800',
  letterSpacing: '-0.08em',
});

const tapeStyle = css({
  display: { base: 'none', lg: 'flex' },
  alignItems: 'stretch',
  minW: 0,
  overflow: 'hidden',
  listStyle: 'none',
  borderInlineWidth: '1px',
  borderColor: 'bone/12',
});

const tapeItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  px: '4',
  fontFamily: 'mono',
  fontSize: 'xs',
  borderInlineEndWidth: '1px',
  borderColor: 'bone/8',
});

const statusActionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '3',
  px: '4',
});

const statusStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  color: 'toxic',
  fontFamily: 'mono',
  fontSize: '2xs',
  textTransform: 'uppercase',
});

const refreshButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  px: '3',
  py: '2',
  color: 'bone',
  borderWidth: '1px',
  borderColor: 'bone/18',
  fontFamily: 'mono',
  fontSize: '2xs',
  cursor: 'pointer',
  _hover: { color: 'toxic', borderColor: 'toxic' },
  _focusVisible: { outline: '2px solid #C7FF2F', outlineOffset: '2px' },
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
      <ul aria-label="Market tape" className={tapeStyle}>
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
        <div aria-live="polite" className={statusStyle}>
          <Activity aria-hidden="true" size={14} />
          <span>{STATUS_LABELS[status]}</span>
          {isoTimestamp ? (
            <time dateTime={isoTimestamp}>{localTime}</time>
          ) : null}
        </div>
        <button
          type="button"
          className={refreshButtonStyle}
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" size={14} />
          Refresh
        </button>
      </div>
    </header>
  );
}
