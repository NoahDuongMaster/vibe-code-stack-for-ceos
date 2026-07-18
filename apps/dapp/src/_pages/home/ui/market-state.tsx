import { AlertTriangle, RotateCcw } from 'lucide-react';
import { css } from '@/styled-system/css';
import { flex, grid } from '@/styled-system/patterns';

const noticeStyle = css({
  display: 'flex',
  flexDirection: { base: 'column', sm: 'row' },
  alignItems: { base: 'stretch', sm: 'center' },
  justifyContent: 'space-between',
  gap: '4',
  p: '3',
  color: 'rekt',
  bgColor: 'rekt/6',
  borderWidth: '1px',
  borderColor: 'rekt/52',
  clipPath:
    'polygon(0 0, calc(100% - 0.65rem) 0, 100% 0.65rem, 100% 100%, 0 100%)',
});

const skeletonRailStyle = grid({
  columns: { base: 2, md: 4 },
  gap: '0',
  overflow: 'clip',
  bgColor: 'carbon',
  borderWidth: '1px',
  borderColor: 'bone/12',
  clipPath:
    'polygon(0 0, calc(100% - 0.75rem) 0, 100% 0.75rem, 100% 100%, 0 100%)',
});

const skeletonCellStyle = css({
  position: 'relative',
  h: { base: '22', md: '24' },
  borderInlineEndWidth: '1px',
  borderBottomWidth: { base: '1px', md: '0' },
  borderColor: 'bone/10',
  _before: {
    content: '""',
    position: 'absolute',
    insetInlineStart: '3',
    top: '4',
    w: '20',
    h: '1.5',
    bgColor: 'bone/10',
  },
  _after: {
    content: '""',
    position: 'absolute',
    insetInlineStart: '3',
    bottom: '4',
    w: '32',
    maxW: '70%',
    h: '3',
    bgColor: 'bone/16',
  },
  '&:nth-child(2n)': {
    borderInlineEndWidth: { base: '0', md: '1px' },
  },
  '&:nth-child(n + 3)': { borderBottomWidth: '0' },
  '&:last-child': { borderInlineEndWidth: '0' },
});

export function MarketLoadingState() {
  return (
    <section
      role="status"
      aria-label="Loading market data"
      className={skeletonRailStyle}
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative skeletons
          key={index}
          className={skeletonCellStyle}
        />
      ))}
      <span className={css({ srOnly: true })}>Loading market data…</span>
    </section>
  );
}

export function MarketErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className={noticeStyle} role="alert">
      <div className={flex({ align: 'center', gap: '3' })}>
        <AlertTriangle aria-hidden="true" size={18} />
        <div>
          <p className={css({ fontFamily: 'mono', fontWeight: '600' })}>
            Market data is temporarily unavailable.
          </p>
          <p className={css({ mt: '1', color: 'bone/58', fontSize: 'sm' })}>
            Check the gateway connection and try the request again.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={flex({
          align: 'center',
          justify: 'center',
          gap: '2',
          px: '4',
          py: '2',
          flexShrink: 0,
          color: 'rekt',
          borderWidth: '1px',
          borderColor: 'rekt/58',
          fontFamily: 'mono',
          fontSize: 'xs',
          fontWeight: '600',
          cursor: 'pointer',
          _hover: { color: 'bone', borderColor: 'rekt' },
          _focusVisible: {
            outline: '2px solid token(colors.rekt)',
            outlineOffset: '3px',
          },
        })}
      >
        <RotateCcw aria-hidden="true" size={14} />
        Retry
      </button>
    </section>
  );
}

export function MarketStaleNotice() {
  return (
    <div className={noticeStyle} role="status">
      <div className={flex({ align: 'center', gap: '3' })}>
        <AlertTriangle aria-hidden="true" size={18} />
        <p>
          <strong>Data may be stale.</strong>{' '}
          <span className={css({ color: 'bone/58' })}>
            The last complete snapshot remains visible while the gateway
            reconnects.
          </span>
        </p>
      </div>
    </div>
  );
}
