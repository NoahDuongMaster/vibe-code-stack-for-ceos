import { css } from '@/styled-system/css';

export const MARKET_SCENE_SHELL_STYLE = css({
  position: 'relative',
  h: { base: '28rem', md: '32rem', xl: '36rem' },
  overflow: 'hidden',
  isolation: 'isolate',
  bgColor: 'void',
  borderWidth: '1px',
  borderColor: 'bone/12',
  clipPath:
    'polygon(0 0, calc(100% - 1.25rem) 0, 100% 1.25rem, 100% 100%, 1.25rem 100%, 0 calc(100% - 1.25rem))',
});
