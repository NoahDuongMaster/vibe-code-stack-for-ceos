'use client';

import { Canvas } from '@react-three/fiber';
import {
  formatMarketChange,
  formatMarketPrice,
} from '@/screens/home/model/market.formatters';
import type { TMarket } from '@/screens/home/model/market.schema';
import type { TMarketBubbleNode } from '@/screens/home/model/market-scene.mapper';
import { MarketGravityWorld } from '@/screens/home/ui/market-gravity-world';
import { MarketLogo } from '@/screens/home/ui/market-logo';
import { MarketSceneFallback } from '@/screens/home/ui/market-scene-fallback';
import { MARKET_SCENE_SHELL_STYLE } from '@/screens/home/ui/market-scene-shell';
import { useMarketSceneActivity } from '@/screens/home/ui/use-market-scene-activity';
import { css, cx } from '@/styled-system/css';

export type TMarketSceneProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  nodes: TMarketBubbleNode[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

const sceneSurfaceStyle = css({
  h: 'full',
  backgroundImage:
    'radial-gradient(circle at 20% 18%, rgba(139, 92, 246, 0.22), transparent 36%), radial-gradient(circle at 80% 72%, rgba(199, 255, 47, 0.08), transparent 32%), linear-gradient(145deg, #050507 0%, #090B12 58%, #050507 100%)',
  _before: {
    content: '""',
    position: 'absolute',
    zIndex: 2,
    inset: '3',
    pointerEvents: 'none',
    borderWidth: '1px',
    borderColor: 'bone/8',
    clipPath:
      'polygon(0 0, calc(100% - 0.8rem) 0, 100% 0.8rem, 100% 100%, 0.8rem 100%, 0 calc(100% - 0.8rem))',
  },
  _after: {
    content: '""',
    position: 'absolute',
    zIndex: 2,
    inset: 0,
    pointerEvents: 'none',
    opacity: 0.28,
    backgroundImage:
      'linear-gradient(transparent 49.7%, rgba(233, 241, 226, 0.05) 50%, transparent 50.3%)',
    backgroundSize: '100% 7px',
    mixBlendMode: 'screen',
  },
});

const sceneActivitySurfaceStyle = css({
  position: 'absolute',
  inset: 0,
});

const chamberHudStyle = css({
  position: 'absolute',
  zIndex: 4,
  insetInline: { base: '4', md: '6' },
  top: { base: '4', md: '5' },
  display: 'flex',
  alignItems: 'start',
  justifyContent: 'space-between',
  gap: '4',
  pointerEvents: 'none',
});

const chamberEyebrowStyle = css({
  color: 'toxic',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  fontWeight: '600',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
});

const chamberTitleStyle = css({
  mt: '1.5',
  color: 'bone',
  fontFamily: 'var(--font-display), ui-sans-serif, system-ui, sans-serif',
  fontSize: { base: 'lg', md: '2xl' },
  fontWeight: '800',
  letterSpacing: '-0.055em',
  lineHeight: '0.95',
  textTransform: 'uppercase',
});

const livePillStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  px: '2.5',
  py: '1.5',
  color: 'bone/72',
  bgColor: 'void/72',
  borderWidth: '1px',
  borderColor: 'bone/12',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  _before: {
    content: '""',
    w: '1.5',
    h: '1.5',
    bgColor: 'toxic',
    borderRadius: 'full',
    boxShadow: '0 0 12px #C7FF2F',
  },
});

const activeReadoutStyle = css({
  position: 'absolute',
  zIndex: 4,
  insetInlineStart: { base: '4', md: '6' },
  bottom: { base: '4', md: '6' },
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: '3',
  minW: { base: '64', md: '80' },
  maxW: 'calc(100% - 2rem)',
  px: '3',
  py: '3',
  overflow: 'hidden',
  pointerEvents: 'none',
  color: 'bone',
  bgColor: 'carbon/82',
  backdropFilter: 'blur(18px)',
  borderWidth: '1px',
  borderColor: 'bone/14',
  borderInlineStartWidth: '2px',
  borderInlineStartColor: 'toxic',
  clipPath:
    'polygon(0 0, calc(100% - 0.75rem) 0, 100% 0.75rem, 100% 100%, 0 100%)',
  boxShadow:
    '0 18px 54px rgba(0, 0, 0, 0.34), inset 0 0 32px rgba(139, 92, 246, 0.05)',
});

const readoutCopyStyle = css({ minW: 0 });

const readoutLabelStyle = css({
  color: 'bone/52',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
});

const readoutSymbolStyle = css({
  display: 'inline',
  fontFamily: 'var(--font-display), ui-sans-serif, system-ui, sans-serif',
  fontSize: { base: 'xl', md: '3xl' },
  fontWeight: '800',
  letterSpacing: '-0.07em',
  lineHeight: '1',
});

const readoutValueStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '2',
  mt: '1.5',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: { base: 'xs', md: 'sm' },
});

const changeTone = (change: number | undefined): string => {
  if ((change ?? 0) > 0) return '#C7FF2F';
  if ((change ?? 0) < 0) return '#FF3B5C';
  return '#8B5CF6';
};

export function MarketScene({
  activeMarketId,
  markets,
  nodes,
  onActiveMarketChange,
}: TMarketSceneProps) {
  const { compactViewport, containerRef, shouldAnimate } =
    useMarketSceneActivity();
  const selectedMarket =
    markets.find(({ id }) => id === activeMarketId) ?? markets[0];

  return (
    <section
      aria-label="Market gravity chamber"
      className={cx(MARKET_SCENE_SHELL_STYLE, sceneSurfaceStyle)}
    >
      <div ref={containerRef} className={sceneActivitySurfaceStyle}>
        <Canvas
          aria-hidden="true"
          camera={{
            position: compactViewport ? [0, 0, 12.8] : [0, 0, 10.8],
            fov: compactViewport ? 48 : 42,
          }}
          dpr={[1, 1.5]}
          fallback={
            <MarketSceneFallback
              activeMarketId={activeMarketId}
              markets={markets}
              nodes={nodes}
            />
          }
          frameloop={shouldAnimate ? 'always' : 'demand'}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        >
          <ambientLight intensity={0.48} />
          <pointLight color="#E9F1E2" intensity={18} position={[2, 6, 7]} />
          <pointLight color="#8B5CF6" intensity={15} position={[-5, 2, 3]} />
          <pointLight color="#C7FF2F" intensity={10} position={[5, -3, 4]} />
          <MarketGravityWorld
            activeMarketId={activeMarketId}
            animate={shouldAnimate}
            compactViewport={compactViewport}
            nodes={nodes}
            onActiveMarketChange={onActiveMarketChange}
          />
        </Canvas>

        <div aria-hidden="true" className={chamberHudStyle}>
          <div>
            <p className={chamberEyebrowStyle}>Zero-G market swarm</p>
            <p className={chamberTitleStyle}>Gravity chamber</p>
          </div>
          <span className={livePillStyle}>live orbit</span>
        </div>

        <div role="status" aria-live="polite" className={activeReadoutStyle}>
          <MarketLogo
            imageUrl={selectedMarket?.imageUrl}
            name={selectedMarket?.name ?? 'No market selected'}
            size={40}
            symbol={selectedMarket?.symbol ?? '—'}
          />
          <div className={readoutCopyStyle}>
            <p className={readoutLabelStyle}>Active orbit / USD</p>
            <p className={readoutSymbolStyle}>
              {selectedMarket?.symbol ?? '—'}
            </p>
            <p className={readoutValueStyle}>
              {formatMarketPrice(selectedMarket?.currentPrice)}
              <span
                style={{
                  color: changeTone(selectedMarket?.priceChangePercentage24h),
                }}
              >
                {formatMarketChange(selectedMarket?.priceChangePercentage24h)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
