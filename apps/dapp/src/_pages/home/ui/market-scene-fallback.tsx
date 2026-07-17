import { MARKET_COIN_IDS } from '@/_pages/home/model/market.constants';
import { css } from '@/styled-system/css';

const FALLBACK_POSITIONS = [
  { left: '12%', top: '22%' },
  { left: '28%', top: '10%' },
  { left: '49%', top: '17%' },
  { left: '72%', top: '9%' },
  { left: '85%', top: '31%' },
  { left: '80%', top: '65%' },
  { left: '62%', top: '78%' },
  { left: '39%', top: '72%' },
  { left: '18%', top: '76%' },
  { left: '8%', top: '51%' },
] as const;

export function MarketSceneFallback() {
  return (
    <div
      data-testid="market-scene-fallback"
      aria-hidden="true"
      className={css({
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        bgColor: 'rgba(7, 16, 24, 0.92)',
        backgroundImage:
          'radial-gradient(circle at center, rgba(103, 232, 249, 0.12), transparent 42%)',
      })}
    >
      <div
        className={css({
          position: 'absolute',
          left: '50%',
          top: '50%',
          w: '28',
          h: '28',
          bgColor: '#a78bfa',
          borderWidth: '1px',
          borderColor: '#e8f5f7',
          rounded: '40%',
          transform: 'translate(-50%, -50%) rotate(24deg)',
          boxShadow:
            '0 0 28px rgba(167, 139, 250, 0.78), 0 0 110px rgba(103, 232, 249, 0.34)',
        })}
      />
      {MARKET_COIN_IDS.map((marketId, index) => (
        <span
          key={marketId}
          className={css({
            position: 'absolute',
            display: 'block',
            w: { base: '4', md: '5' },
            h: { base: '4', md: '5' },
            bgColor: index % 3 === 0 ? '#fb7185' : '#67e8f9',
            borderWidth: '2px',
            borderColor: 'rgba(232, 245, 247, 0.72)',
            rounded: 'full',
            boxShadow: '0 0 18px currentColor',
          })}
          style={FALLBACK_POSITIONS[index]}
        />
      ))}
      <span
        className={css({
          position: 'absolute',
          left: '50%',
          top: '50%',
          w: '60%',
          aspectRatio: '1',
          borderWidth: '1px',
          borderColor: 'rgba(103, 232, 249, 0.2)',
          rounded: 'full',
          transform: 'translate(-50%, -50%) rotate(-12deg) scaleY(0.42)',
        })}
      />
    </div>
  );
}
