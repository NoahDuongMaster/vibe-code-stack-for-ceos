'use client';

import { Edges, Grid, RoundedBox, Sparkles } from '@react-three/drei';
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

const BLADE_BEVEL_RADIUS = 0.08;
const BLADE_BEVEL_SEGMENTS = 2;
const LANE_Z_POSITIONS = [-1.45, 1.45] as const;

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
      <RoundedBox
        args={[node.width, node.height, node.depth]}
        bevelSegments={BLADE_BEVEL_SEGMENTS}
        creaseAngle={0.42}
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
        radius={BLADE_BEVEL_RADIUS}
        smoothness={BLADE_BEVEL_SEGMENTS}
      >
        <meshStandardMaterial
          color={highlighted ? '#161A14' : '#0A0D0B'}
          emissive={node.color}
          emissiveIntensity={
            node.emissiveIntensity * (highlighted ? 0.3 : 0.08)
          }
          metalness={0.9}
          roughness={0.26}
          toneMapped={false}
        />
        <Edges
          color={highlighted ? '#E9F1E2' : node.color}
          lineWidth={0.5}
          opacity={highlighted ? 0.7 : 0.22}
          threshold={12}
          transparent
        />
      </RoundedBox>
      <mesh
        name={`market-cap-${node.id}`}
        position={[0, node.height / 2 + 0.035, 0]}
      >
        <boxGeometry args={[node.width * 0.82, 0.07, node.depth * 0.82]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={
            node.emissiveIntensity * (highlighted ? 2.4 : 1.15)
          }
          metalness={0.34}
          roughness={0.18}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function ScanPlane({ animate }: { animate: boolean }) {
  const scanRef = useRef<Group>(null);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (!animate || !scanRef.current) return;
    elapsedRef.current += delta;
    const progress = (elapsedRef.current * 0.13) % 1;
    scanRef.current.position.x = MathUtils.lerp(-3.45, 3.45, progress);
  });

  if (!animate) return null;

  return (
    <group ref={scanRef} position={[-3.45, 0.13, 0]}>
      <mesh name="liquidity-scan">
        <boxGeometry args={[0.026, 0.012, 4.2]} />
        <meshBasicMaterial
          color="#C7FF2F"
          depthWrite={false}
          opacity={0.18}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

function ActiveMarketBeam({
  animate,
  node,
}: {
  animate: boolean;
  node: TMarketSceneNode;
}) {
  const beamRef = useRef<Group>(null);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (!animate || !beamRef.current) return;
    elapsedRef.current += delta;
    const pulse = 1 + Math.sin(elapsedRef.current * 1.35) * 0.035;
    beamRef.current.scale.y = pulse;
  });

  return (
    <group
      data-lane-position={`${node.position[0]},${node.position[2]}`}
      position={[node.position[0], 0, node.position[2]]}
    >
      <group ref={beamRef} position={[0, 2.75, 0]}>
        <mesh
          data-market-id={node.id}
          name="active-market-beam"
          renderOrder={3}
        >
          <boxGeometry args={[0.035, 5.5, 0.035]} />
          <meshBasicMaterial
            color="#C7FF2F"
            depthTest={false}
            depthWrite={false}
            opacity={0.76}
            toneMapped={false}
            transparent
          />
        </mesh>
        <mesh
          data-market-id={node.id}
          name="active-market-beam-sheath"
          renderOrder={2}
        >
          <boxGeometry args={[0.18, 5.5, 0.18]} />
          <meshBasicMaterial
            color="#C7FF2F"
            depthTest={false}
            depthWrite={false}
            opacity={0.065}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.31, 24]} />
        <meshBasicMaterial
          color="#C7FF2F"
          depthWrite={false}
          opacity={0.5}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

function LiquidityLane({ index, z }: { index: number; z: number }) {
  return (
    <mesh name={`liquidity-lane-${index + 1}`} position={[0, 0.055, z]}>
      <boxGeometry args={[7.15, 0.11, 1.08]} />
      <meshStandardMaterial
        color="#0A0D0B"
        emissive={index === 0 ? '#8B5CF6' : '#C7FF2F'}
        emissiveIntensity={0.045}
        metalness={0.92}
        roughness={0.34}
      />
    </mesh>
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
  const activeNode = nodes.find(({ id }) => id === activeMarketId) ?? nodes[0];

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
        position={[0, -0.025, 0]}
        sectionColor="#C7FF2F"
        sectionSize={2.5}
        sectionThickness={0.55}
      />
      {LANE_Z_POSITIONS.map((z, index) => (
        <LiquidityLane key={z} index={index} z={z} />
      ))}
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[7.4, 0.07, 0.86]} />
        <meshStandardMaterial
          color="#050507"
          metalness={0.96}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, 0.078, 0]}>
        <boxGeometry args={[6.8, 0.01, 0.018]} />
        <meshBasicMaterial
          color="#8B5CF6"
          opacity={0.22}
          toneMapped={false}
          transparent
        />
      </mesh>
      <ScanPlane animate={animate} />
      {activeNode ? (
        <ActiveMarketBeam animate={animate} node={activeNode} />
      ) : null}
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
        count={22}
        opacity={0.22}
        scale={[11, 5, 7]}
        size={0.64}
        speed={animate ? 0.08 : 0}
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
            position: compactViewport ? [6.4, 6.8, 11.6] : [4.6, 5.2, 7.1],
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
            camera.lookAt(0, compactViewport ? 1.15 : 1.25, 0)
          }
        >
          <ambientLight intensity={0.42} />
          <pointLight color="#E9F1E2" intensity={20} position={[4, 8, 7]} />
          <pointLight color="#8B5CF6" intensity={16} position={[-5, 4, -2]} />
          <pointLight color="#C7FF2F" intensity={11} position={[3, 2, 4]} />
          <pointLight color="#FF3B5C" intensity={7} position={[4, 1, -4]} />
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
