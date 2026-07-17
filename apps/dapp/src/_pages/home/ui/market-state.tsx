import { AlertTriangle, RotateCcw } from 'lucide-react';
import { css } from '@/styled-system/css';
import { flex, grid } from '@/styled-system/patterns';

const noticeStyle = flex({
  align: 'center',
  justify: 'space-between',
  gap: '4',
  p: '4',
  color: '#ffd5dc',
  bgColor: 'rgba(251, 113, 133, 0.08)',
  borderWidth: '1px',
  borderColor: 'rgba(251, 113, 133, 0.28)',
  rounded: 'lg',
});

export function MarketLoadingState() {
  return (
    <section
      role="status"
      aria-label="Loading market data"
      className={grid({ columns: { base: 1, sm: 2, xl: 4 }, gap: '3' })}
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative skeletons
          key={index}
          className={css({
            h: '32',
            bgColor: 'rgba(145, 169, 180, 0.08)',
            borderWidth: '1px',
            borderColor: 'rgba(145, 169, 180, 0.12)',
            rounded: 'xl',
            animation: 'pulse 1.8s ease-in-out infinite',
          })}
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
        <AlertTriangle aria-hidden="true" size={20} />
        <div>
          <p className={css({ fontWeight: 'semibold' })}>
            Market data is temporarily unavailable.
          </p>
          <p className={css({ mt: '1', color: '#b8c8ce', fontSize: 'sm' })}>
            Check the gateway connection and try the request again.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={flex({
          align: 'center',
          gap: '2',
          px: '4',
          py: '2',
          flexShrink: 0,
          color: '#071018',
          bgColor: '#fb7185',
          rounded: 'full',
          fontWeight: 'bold',
          cursor: 'pointer',
          _focusVisible: {
            outline: '2px solid #e8f5f7',
            outlineOffset: '3px',
          },
        })}
      >
        <RotateCcw aria-hidden="true" size={15} />
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
          <strong>Data may be stale.</strong> The last complete snapshot remains
          visible while the gateway reconnects.
        </p>
      </div>
    </div>
  );
}
