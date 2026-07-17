'use client';

import { Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { CylinderGeometry, MathUtils, TorusGeometry } from 'three';
import {
  formatMarketChange,
  formatMarketPrice,
} from '@/_pages/home/model/market.formatters';
import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketSceneNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketSceneFallback } from '@/_pages/home/ui/market-scene-fallback';
import { useMarketSceneActivity } from '@/_pages/home/ui/use-market-scene-activity';
import { css } from '@/styled-system/css';

export type TMarketSceneProps = {
  activeMarketId?: TMarket['id'];
  markets: TMarket[];
  nodes: TMarketSceneNode[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
};

type TMarketTokenProps = {
  active: boolean;
  animate: boolean;
  node: TMarketSceneNode;
  onActiveMarketChange: (marketId: TMarket['id']) => void;
  tokenGeometry: CylinderGeometry;
  tokenRingGeometry: TorusGeometry;
};

function MarketToken({
  active,
  animate,
  node,
  onActiveMarketChange,
  tokenGeometry,
  tokenRingGeometry,
}: TMarketTokenProps) {
  const tokenRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  useFrame(({ clock }, delta) => {
    if (!animate || !tokenRef.current) return;
    const angle = node.phase + clock.elapsedTime * node.orbitSpeed;
    tokenRef.current.position.set(
      Math.cos(angle) * node.orbitRadius,
      node.verticalOffset + Math.sin(angle * 1.35) * 0.42,
      Math.sin(angle) * node.orbitRadius * 0.34,
    );
    tokenRef.current.rotation.z += delta * 0.28;
  });

  return (
    <group
      ref={tokenRef}
      position={[
        Math.cos(node.phase) * node.orbitRadius,
        node.verticalOffset,
        Math.sin(node.phase) * node.orbitRadius * 0.34,
      ]}
      rotation={[Math.PI / 2, 0, node.phase]}
      scale={node.scale * (highlighted ? 1.16 : 1)}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: WebGL pointer target; equivalent keyboard controls live in MarketTable. */}
      <mesh
        name={node.id}
        geometry={tokenGeometry}
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
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={node.emissiveIntensity * (highlighted ? 1.45 : 1)}
          metalness={0.72}
          roughness={0.2}
        />
      </mesh>
      <mesh geometry={tokenRingGeometry} position={[0, 0.09, 0]}>
        <meshBasicMaterial
          color="#e8f5f7"
          opacity={highlighted ? 0.95 : 0.46}
          transparent
        />
      </mesh>
    </group>
  );
}

function MarketWorld({
  activeMarketId,
  animate,
  nodes,
  onActiveMarketChange,
}: Pick<
  TMarketSceneProps,
  'activeMarketId' | 'nodes' | 'onActiveMarketChange'
> & { animate: boolean }) {
  const worldRef = useRef<Group>(null);
  const tokenGeometry = useMemo(
    () => new CylinderGeometry(0.54, 0.54, 0.16, 24),
    [],
  );
  const tokenRingGeometry = useMemo(
    () => new TorusGeometry(0.38, 0.035, 8, 24),
    [],
  );

  useFrame(({ pointer }, delta) => {
    if (!animate || !worldRef.current) return;
    worldRef.current.rotation.x = MathUtils.damp(
      worldRef.current.rotation.x,
      -pointer.y * 0.08,
      3,
      delta,
    );
    worldRef.current.rotation.y = MathUtils.damp(
      worldRef.current.rotation.y,
      pointer.x * 0.12,
      3,
      delta,
    );
  });

  return (
    <group ref={worldRef}>
      <mesh rotation={[0.4, 0.2, -0.24]}>
        <icosahedronGeometry args={[1.12, 2]} />
        <meshStandardMaterial
          color="#a78bfa"
          emissive="#67e8f9"
          emissiveIntensity={1.25}
          metalness={0.58}
          roughness={0.18}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
        <torusGeometry args={[1.72, 0.018, 8, 96]} />
        <meshBasicMaterial color="#67e8f9" opacity={0.48} transparent />
      </mesh>
      <mesh rotation={[Math.PI / 2.1, -0.42, 0.8]}>
        <torusGeometry args={[2.15, 0.012, 8, 96]} />
        <meshBasicMaterial color="#a78bfa" opacity={0.3} transparent />
      </mesh>
      <Sparkles
        color="#e8f5f7"
        count={72}
        noise={1.2}
        opacity={0.55}
        scale={[9, 5, 4]}
        size={1.4}
        speed={animate ? 0.18 : 0}
      />
      {nodes.map((node) => (
        <MarketToken
          key={node.id}
          active={node.id === activeMarketId}
          animate={animate}
          node={node}
          onActiveMarketChange={onActiveMarketChange}
          tokenGeometry={tokenGeometry}
          tokenRingGeometry={tokenRingGeometry}
        />
      ))}
    </group>
  );
}

export function MarketScene({
  activeMarketId,
  markets,
  nodes,
  onActiveMarketChange,
}: TMarketSceneProps) {
  const { containerRef, shouldAnimate } = useMarketSceneActivity();
  const selectedMarket =
    markets.find(({ id }) => id === activeMarketId) ?? markets[0];

  return (
    <div
      ref={containerRef}
      className={css({
        position: 'relative',
        minH: { base: '80', lg: '112' },
        overflow: 'hidden',
        bgColor: 'rgba(7, 16, 24, 0.72)',
        borderWidth: '1px',
        borderColor: 'rgba(103, 232, 249, 0.18)',
        rounded: '2xl',
      })}
    >
      <Canvas
        aria-hidden="true"
        dpr={[1, 1.5]}
        frameloop={shouldAnimate ? 'always' : 'demand'}
        fallback={<MarketSceneFallback />}
        camera={{ position: [0, 1.2, 9], fov: 42 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <ambientLight intensity={0.55} />
        <pointLight position={[0, 1, 3]} intensity={18} color="#67e8f9" />
        <pointLight position={[-4, -2, 2]} intensity={9} color="#fb7185" />
        <MarketWorld
          nodes={nodes}
          activeMarketId={activeMarketId}
          animate={shouldAnimate}
          onActiveMarketChange={onActiveMarketChange}
        />
      </Canvas>

      <div
        role="status"
        aria-live="polite"
        className={css({
          position: 'absolute',
          insetInlineStart: { base: '4', md: '6' },
          bottom: { base: '4', md: '6' },
          minW: '44',
          p: '4',
          pointerEvents: 'none',
          bgColor: 'rgba(7, 16, 24, 0.78)',
          backdropFilter: 'blur(12px)',
          borderWidth: '1px',
          borderColor: 'rgba(103, 232, 249, 0.24)',
          rounded: 'lg',
        })}
      >
        <p
          className={css({
            color: '#91a9b4',
            fontFamily: 'mono',
            fontSize: '2xs',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          })}
        >
          Active body
        </p>
        <p className={css({ mt: '1', fontSize: 'lg', fontWeight: 'bold' })}>
          {selectedMarket?.name ?? 'Awaiting market data'}
        </p>
        <p
          className={css({
            mt: '2',
            color: '#e8f5f7',
            fontFamily: 'mono',
            fontSize: 'sm',
          })}
        >
          {formatMarketPrice(selectedMarket?.currentPrice)} ·{' '}
          {formatMarketChange(selectedMarket?.priceChangePercentage24h)}
        </p>
      </div>
    </div>
  );
}
