import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';
import { useHealth } from '../_hooks/use-health';

export function HealthStatus() {
  const { data, isLoading, isError } = useHealth();

  const ok = !isLoading && !isError && !!data;
  const label = isLoading
    ? 'checking…'
    : isError || !data
      ? 'unreachable'
      : `${data.status} — ${data.service} (${data.runtime})`;

  return (
    <div className={flex({ align: 'center', gap: '2', fontSize: 'sm' })}>
      <span
        className={css({
          w: '2.5',
          h: '2.5',
          rounded: 'full',
          bg: ok ? 'success' : isLoading ? 'muted.foreground' : 'destructive',
          flexShrink: 0,
        })}
        aria-hidden="true"
      />
      <span className={css({ color: 'muted.foreground' })}>API health:</span>
      <strong>{label}</strong>
    </div>
  );
}
