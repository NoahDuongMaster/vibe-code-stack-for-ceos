import { Activity, RefreshCw } from 'lucide-react';
import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

type TMarketHeaderStatus = 'live' | 'loading' | 'stale' | 'updating';

type TMarketHeaderProps = {
  lastUpdatedAt?: number;
  onRefresh: () => void;
  status: TMarketHeaderStatus;
};

const STATUS_LABELS: Record<TMarketHeaderStatus, string> = {
  live: 'Live',
  loading: 'Connecting',
  stale: 'Data may be stale',
  updating: 'Updating',
};

const headerStyle = flex({
  direction: { base: 'column', md: 'row' },
  align: { base: 'flex-start', md: 'flex-end' },
  justify: 'space-between',
  gap: '6',
  pb: '7',
  borderBottomWidth: '1px',
  borderColor: 'rgba(103, 232, 249, 0.16)',
});

const refreshButtonStyle = flex({
  align: 'center',
  gap: '2',
  px: '4',
  py: '2.5',
  color: '#e8f5f7',
  bgColor: 'rgba(13, 25, 35, 0.86)',
  borderWidth: '1px',
  borderColor: 'rgba(103, 232, 249, 0.28)',
  rounded: 'full',
  fontFamily: 'mono',
  fontSize: 'xs',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'border-color 160ms ease, background-color 160ms ease',
  _hover: {
    bgColor: 'rgba(103, 232, 249, 0.1)',
    borderColor: '#67e8f9',
  },
  _focusVisible: {
    outline: '2px solid #67e8f9',
    outlineOffset: '3px',
  },
});

export function MarketHeader({
  lastUpdatedAt,
  onRefresh,
  status,
}: TMarketHeaderProps) {
  const isoTimestamp = lastUpdatedAt
    ? new Date(lastUpdatedAt).toISOString()
    : undefined;

  return (
    <header className={headerStyle}>
      <div>
        <p
          className={css({
            mb: '3',
            color: '#67e8f9',
            fontFamily: 'mono',
            fontSize: 'xs',
            fontWeight: 'semibold',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          })}
        >
          Public market command deck / USD
        </p>
        <h1
          className={css({
            maxW: '8xl',
            fontSize: { base: '4xl', md: '6xl', lg: '7xl' },
            fontWeight: 'black',
            letterSpacing: '-0.055em',
            lineHeight: '0.92',
          })}
        >
          Vibe Markets
        </h1>
        <p
          className={css({
            mt: '4',
            maxW: '2xl',
            color: '#91a9b4',
            fontSize: { base: 'sm', md: 'md' },
            lineHeight: '1.7',
          })}
        >
          Ten liquid crypto assets mapped into one live market topology. Compare
          the numbers, then use the scene to feel the momentum.
        </p>
      </div>

      <div
        className={flex({
          direction: 'column',
          align: { base: 'flex-start', md: 'flex-end' },
          gap: '3',
          flexShrink: 0,
        })}
      >
        <div
          className={flex({
            align: 'center',
            gap: '2',
            color: status === 'stale' ? '#fb7185' : '#67e8f9',
            fontFamily: 'mono',
            fontSize: 'xs',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          })}
          aria-live="polite"
        >
          <Activity aria-hidden="true" size={15} />
          <span>{STATUS_LABELS[status]}</span>
          {isoTimestamp ? (
            <time dateTime={isoTimestamp} className={css({ color: '#91a9b4' })}>
              · {new Date(isoTimestamp).toLocaleTimeString('en-US')}
            </time>
          ) : null}
        </div>
        <button
          type="button"
          className={refreshButtonStyle}
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" size={15} />
          Refresh snapshot
        </button>
      </div>
    </header>
  );
}
