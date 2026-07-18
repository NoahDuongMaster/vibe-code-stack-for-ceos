'use client';

import { Grid, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { MathUtils } from 'three';
import {
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketSceneNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketSceneFallback } from '@/_pages/home/ui/market-scene-fallback';
import { MARKET_SCENE_SHELL_STYLE } from '@/_pages/home/ui/market-scene-shell';
import { useMarketSceneActivity } from '@/_pages/home/ui/use-market-scene-activity';
import { css, cx } from '@/styled-system/css';

export type TMarketSceneProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  nodes: TMarketSceneNode[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

type TMarketBladeProps = {
  active: boolean;
  animate: boolean;
  node: TMarketSceneNode;
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

const activeReadoutStyle = css({
  position: 'absolute',
  insetInlineStart: { base: '3', md: '5' },
  bottom: { base: '3', md: '5' },
  minW: { base: '52', md: '64' },
  maxW: 'calc(100% - 1.5rem)',
  px: '4',
  py: '3',
  overflow: 'clip',
  pointerEvents: 'none',
  color: 'bone',
  bgColor: 'carbon/88',
  backdropFilter: 'blur(12px)',
  borderWidth: '1px',
  borderColor: 'bone/14',
  borderInlineStartWidth: '2px',
  borderInlineStartColor: 'toxic',
  clipPath:
    'polygon(0 0, calc(100% - 0.65rem) 0, 100% 0.65rem, 100% 100%, 0 100%)',
  _after: {
    content: '""',
    position: 'absolute',
    insetInlineEnd: '3',
    top: '3',
    w: '1.5',
    h: '1.5',
    bgColor: 'toxic',
    boxShadow: '0 0 14px #C7FF2F',
  },
});

const readoutLabelStyle = css({
  color: 'bone/62',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: '2xs',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
});

const readoutSymbolStyle = css({
  mt: '1.5',
  fontFamily: 'var(--font-display), ui-sans-serif, system-ui, sans-serif',
  fontSize: { base: '3xl', md: '5xl' },
  fontWeight: '800',
  letterSpacing: '-0.08em',
  lineHeight: '0.9',
});

const readoutValueStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  mt: '2',
  fontFamily: 'var(--font-mono), ui-monospace, monospace',
  fontSize: { base: 'sm', md: 'md' },
});

const sceneSurfaceStyle = css({
  h: 'full',
  backgroundImage:
    'radial-gradient(circle at 72% 28%, rgba(139, 92, 246, 0.16), transparent 44%)',
  _before: {
    content: '""',
    position: 'absolute',
    zIndex: 1,
    insetInline: '3',
    top: '3',
    h: '1px',
    pointerEvents: 'none',
    bgColor: 'bone/12',
  },
});

const sceneActivitySurfaceStyle = css({
  position: 'absolute',
  inset: 0,
});

const changeTone = (change: number | undefined): string => {
  if ((change ?? 0) > 0) return '#C7FF2F';
  if ((change ?? 0) < 0) return '#FF3B5C';
  return '#8B5CF6';
};

function MarketBlade({
  active,
  animate,
  node,
  onActiveMarketChange,
}: TMarketBladeProps) {
  const bladeRef = useRef<Group>(null);
  const elapsedRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  useFrame((_, delta) => {
    if (!animate || !bladeRef.current) return;
    elapsedRef.current += delta;
    const reveal = MathUtils.clamp(
      (elapsedRef.current - node.revealDelay) * 1.8,
      0,
      1,
    );
    bladeRef.current.position.y = MathUtils.damp(
      bladeRef.current.position.y,
      (node.height * reveal) / 2,
      5,
      delta,
    );
    const pulseAmplitude = 0.012 + node.pulseStrength * 0.018;
    const pulse =
      1 +
      Math.sin(elapsedRef.current * 1.6 + node.revealDelay) * pulseAmplitude;
    bladeRef.current.scale.y = highlighted ? pulse * 1.035 : pulse;
  });

  return (
    <group
      ref={bladeRef}
      position={[
        node.position[0],
        animate ? 0 : node.height / 2,
        node.position[2],
      ]}
      rotation={[0, 0, node.lean]}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: equivalent keyboard selection is provided by MarketWatchlist and MarketTable. */}
      <mesh
        name={node.id}
        onClick={(event) => {
          event.stopPropagation();
          onActiveMarketChange(node.id);
        }}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
      >
        <boxGeometry args={[node.width, node.height, node.depth]} />
        <meshStandardMaterial
          color={highlighted ? '#E9F1E2' : node.color}
          emissive={node.color}
          emissiveIntensity={
            node.emissiveIntensity *
            (highlighted ? 2 : 1.05 + node.pulseStrength)
          }
          metalness={0.42}
          roughness={0.16}
          toneMapped={false}
        />
      </mesh>
      {highlighted ? (
        <mesh position={[0, node.height / 2 + 0.05, 0]}>
          <boxGeometry args={[node.width * 1.35, 0.025, node.depth * 1.35]} />
          <meshBasicMaterial color="#C7FF2F" />
        </mesh>
      ) : null}
    </group>
  );
}

function ScanPlane({ animate }: { animate: boolean }) {
  const scanRef = useRef<Group>(null);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (!animate || !scanRef.current) return;
    elapsedRef.current += delta;
    const progress = (elapsedRef.current * 0.18) % 1;
    scanRef.current.position.x = MathUtils.lerp(-3.8, 3.8, progress);
  });

  return (
    <group ref={scanRef} position={[-3.8, 1.5, 0]}>
      <mesh>
        <boxGeometry args={[0.018, 0.035, 7]} />
        <meshBasicMaterial color="#C7FF2F" opacity={0.32} transparent />
      </mesh>
    </group>
  );
}

function ReactorWorld({
  activeMarketId,
  animate,
  nodes,
  onActiveMarketChange,
}: Pick<
  TMarketSceneProps,
  'activeMarketId' | 'nodes' | 'onActiveMarketChange'
> & { animate: boolean }) {
  const worldRef = useRef<Group>(null);

  useFrame(({ pointer }, delta) => {
    if (!animate || !worldRef.current) return;
    worldRef.current.rotation.x = MathUtils.damp(
      worldRef.current.rotation.x,
      -pointer.y * 0.045,
      3,
      delta,
    );
    worldRef.current.rotation.y = MathUtils.damp(
      worldRef.current.rotation.y,
      pointer.x * 0.045,
      3,
      delta,
    );
  });

  return (
    <group ref={worldRef}>
      <Grid
        args={[14, 8]}
        cellColor="#8B5CF6"
        cellSize={0.5}
        cellThickness={0.35}
        fadeDistance={12}
        fadeStrength={1.4}
        infiniteGrid={false}
        position={[0, 0, 0]}
        sectionColor="#C7FF2F"
        sectionSize={2.5}
        sectionThickness={0.55}
      />
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[7.2, 0.06, 0.72]} />
        <meshStandardMaterial color="#050507" metalness={0.9} roughness={0.3} />
      </mesh>
      <ScanPlane animate={animate} />
      {nodes.map((node) => (
        <MarketBlade
          key={node.id}
          active={node.id === activeMarketId}
          animate={animate}
          node={node}
          onActiveMarketChange={onActiveMarketChange}
        />
      ))}
      <Sparkles
        color="#E9F1E2"
        count={38}
        opacity={0.36}
        scale={[11, 5, 7]}
        size={0.8}
        speed={animate ? 0.12 : 0}
      />
    </group>
  );
}

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
      aria-label="Liquidity reactor"
      className={cx(MARKET_SCENE_SHELL_STYLE, sceneSurfaceStyle)}
    >
      <div ref={containerRef} className={sceneActivitySurfaceStyle}>
        <Canvas
          aria-hidden="true"
          camera={{
            position: compactViewport ? [0, 5.8, 13.2] : [0, 5.4, 9.4],
            fov: compactViewport ? 44 : 38,
          }}
          dpr={[1, 1.5]}
          fallback={<MarketSceneFallback />}
          frameloop={shouldAnimate ? 'always' : 'demand'}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
          }}
          onCreated={({ camera }) =>
            camera.lookAt(0, compactViewport ? 1 : 1.1, 0)
          }
        >
          <ambientLight intensity={0.34} />
          <pointLight color="#C7FF2F" intensity={18} position={[2, 7, 4]} />
          <pointLight color="#8B5CF6" intensity={12} position={[-5, 3, 1]} />
          <pointLight color="#FF3B5C" intensity={8} position={[4, 1, -3]} />
          <ReactorWorld
            activeMarketId={activeMarketId}
            animate={shouldAnimate}
            nodes={nodes}
            onActiveMarketChange={onActiveMarketChange}
          />
        </Canvas>

        <div role="status" aria-live="polite" className={activeReadoutStyle}>
          <p className={readoutLabelStyle}>Active market / USD</p>
          <p className={readoutSymbolStyle}>{selectedMarket?.symbol ?? '—'}</p>
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
    </section>
  );
}
