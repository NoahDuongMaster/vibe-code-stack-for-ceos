import { css } from '@/styled-system/css';
import { flex } from '@/styled-system/patterns';

const Loading = () => {
  return (
    <div
      className={flex({
        minH: '100vh',
        alignItems: 'center',
        justify: 'center',
        bg: 'background',
      })}
    >
      <div
        className={css({
          w: '10',
          h: '10',
          rounded: 'full',
          borderWidth: '3px',
          borderColor: 'muted',
          borderTopColor: 'primary',
          animationName: 'spin',
          animationDuration: '0.6s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        })}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
};

export default Loading;
