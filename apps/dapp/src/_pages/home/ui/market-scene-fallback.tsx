import { MARKET_COIN_IDS } from '@/_pages/home/model/market.constants';
import { css } from '@/styled-system/css';

const FALLBACK_COLORS = ['#C7FF2F', '#8B5CF6', '#FF3B5C'] as const;

const fallbackStyle = css({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  bgColor: 'void',
  backgroundImage:
    'linear-gradient(135deg, rgba(139, 92, 246, 0.2), transparent 44%), repeating-linear-gradient(90deg, rgba(233, 241, 226, 0.035) 0, rgba(233, 241, 226, 0.035) 1px, transparent 1px, transparent 7.5%)',
});

const trenchStyle = css({
  position: 'absolute',
  insetInlineStart: '8%',
  top: '50%',
  w: '84%',
  h: '12',
  bgColor: 'void',
  backgroundImage:
    'repeating-linear-gradient(90deg, rgba(199, 255, 47, 0.2) 0, rgba(199, 255, 47, 0.2) 1px, transparent 1px, transparent 12%)',
  borderBlockWidth: '1px',
  borderColor: 'plasma/60',
  transform: 'translateY(-50%) skewX(-8deg)',
  boxShadow: '0 0 34px rgba(139, 92, 246, 0.24)',
});

const bladeStyle = css({
  position: 'absolute',
  display: 'block',
  w: { base: '5', md: '7' },
  borderWidth: '1px',
  borderColor: 'bone/38',
  clipPath: 'polygon(18% 0, 100% 0, 82% 100%, 0 100%)',
  boxShadow:
    '0 0 20px rgba(199, 255, 47, 0.16), 0 0 38px rgba(139, 92, 246, 0.12)',
});

export function MarketSceneFallback() {
  return (
    <div
      data-testid="market-scene-fallback"
      aria-hidden="true"
      className={fallbackStyle}
    >
      <div className={trenchStyle} />
      {MARKET_COIN_IDS.map((marketId, index) => {
        const upperRow = index % 2 === 0;
        const height = 24 + (index * 48) / (MARKET_COIN_IDS.length - 1);

        return (
          <span
            key={marketId}
            data-testid="reactor-fallback-blade"
            className={bladeStyle}
            style={{
              backgroundColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
              bottom: upperRow ? '50%' : undefined,
              height: `${height}%`,
              left: `${7 + index * 9.5}%`,
              top: upperRow ? undefined : '50%',
              transform: upperRow ? 'skewX(-5deg)' : 'skewX(5deg)',
              transformOrigin: upperRow ? 'bottom' : 'top',
            }}
          />
        );
      })}
    </div>
  );
}
