'use client';

import { useState } from 'react';
import type { Group } from 'three';
import { BackSide } from 'three';
import type { TMarket } from '@/_pages/home/model/market.schema';
import type { TMarketBubbleNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketLogoTexture } from '@/_pages/home/ui/market-logo-texture';

export function MarketBubble({
  active,
  node,
  objectRef,
  onActiveMarketChange,
}: {
  active: boolean;
  node: TMarketBubbleNode;
  objectRef: (object: Group | null) => void;
  onActiveMarketChange: (marketId: TMarket['id']) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  return (
    <group
      ref={objectRef}
      name={`market-bubble-${node.id}`}
      scale={highlighted ? 1.06 : 1}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: R3F supplies scene pointer events; equivalent keyboard selection is available in the watchlist and market table. */}
      <mesh
        name={`market-bubble-shell-${node.id}`}
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
        <sphereGeometry args={[node.radius, 48, 32]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.12}
          color="#090D12"
          emissive={node.haloColor}
          emissiveIntensity={highlighted ? 0.18 : 0.06}
          metalness={0.36}
          opacity={0.82}
          roughness={0.18}
          transparent
        />
      </mesh>
      <mesh name={`market-halo-${node.id}`} renderOrder={0} scale={1.1}>
        <sphereGeometry args={[node.radius, 32, 20]} />
        <meshBasicMaterial
          color={node.haloColor}
          depthWrite={false}
          opacity={node.haloIntensity * (highlighted ? 0.22 : 0.09)}
          side={BackSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <MarketLogoTexture
        imageUrl={node.imageUrl}
        radius={node.radius}
        symbol={node.symbol}
      />
    </group>
  );
}
