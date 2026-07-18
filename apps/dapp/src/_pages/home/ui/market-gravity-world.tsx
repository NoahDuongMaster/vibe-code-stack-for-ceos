'use client';

import { Sparkles } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import type { TMarket } from '@/_pages/home/model/market.schema';
import {
  advanceGravitySimulation,
  createGravitySimulation,
  syncGravityBodies,
} from '@/_pages/home/model/market-gravity.simulation';
import type {
  TMarketBubbleNode,
  TVector3Tuple,
} from '@/_pages/home/model/market-scene.mapper';
import { MarketBubble } from '@/_pages/home/ui/market-bubble';

const SIMULATION_BOUNDS = [4.25, 2.35, 1.35] as const;

export function MarketGravityWorld({
  activeMarketId,
  animate,
  compactViewport,
  nodes,
  onActiveMarketChange,
}: {
  activeMarketId?: TMarket['id'];
  animate: boolean;
  compactViewport: boolean;
  nodes: TMarketBubbleNode[];
  onActiveMarketChange: (marketId: TMarket['id']) => void;
}) {
  const [simulation] = useState(() => createGravitySimulation(nodes));
  const bubbleRefs = useRef(new Map<TMarket['id'], Group>());
  const pointerActiveRef = useRef(false);
  const { gl } = useThree();

  useEffect(() => {
    syncGravityBodies(simulation, nodes);
    for (const body of simulation.bodies) {
      bubbleRefs.current.get(body.id)?.position.set(...body.position);
    }
  }, [nodes, simulation]);

  useEffect(() => {
    const activatePointer = () => {
      pointerActiveRef.current = true;
    };
    const deactivatePointer = () => {
      pointerActiveRef.current = false;
    };

    gl.domElement.addEventListener('pointermove', activatePointer, {
      passive: true,
    });
    gl.domElement.addEventListener('pointerleave', deactivatePointer);

    return () => {
      gl.domElement.removeEventListener('pointermove', activatePointer);
      gl.domElement.removeEventListener('pointerleave', deactivatePointer);
    };
  }, [gl]);

  useFrame(({ pointer }, delta) => {
    if (!animate) return;
    const pointerPosition: TVector3Tuple = [
      pointer.x * SIMULATION_BOUNDS[0],
      pointer.y * SIMULATION_BOUNDS[1],
      0.4,
    ];

    advanceGravitySimulation(simulation, {
      activeMarketId,
      bounds: SIMULATION_BOUNDS,
      frameDelta: delta,
      pointer: {
        active: pointerActiveRef.current,
        position: pointerPosition,
      },
    });

    for (const body of simulation.bodies) {
      bubbleRefs.current.get(body.id)?.position.set(...body.position);
    }
  });

  return (
    <group name="market-gravity-world" scale={compactViewport ? 0.74 : 1}>
      {nodes.map((node) => (
        <MarketBubble
          key={node.id}
          active={node.id === activeMarketId}
          node={node}
          objectRef={(object) => {
            if (!object) {
              bubbleRefs.current.delete(node.id);
              return;
            }

            bubbleRefs.current.set(node.id, object);
            const body = simulation.bodies.find(({ id }) => id === node.id);
            if (body) object.position.set(...body.position);
          }}
          onActiveMarketChange={onActiveMarketChange}
        />
      ))}

      <mesh name="market-orbit-primary" rotation={[1.2, 0.18, 0.36]}>
        <torusGeometry args={[3.2, 0.006, 8, 96]} />
        <meshBasicMaterial
          color="#8B5CF6"
          depthWrite={false}
          opacity={0.22}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh name="market-orbit-secondary" rotation={[1.42, -0.34, -0.2]}>
        <torusGeometry args={[2.45, 0.004, 8, 96]} />
        <meshBasicMaterial
          color="#C7FF2F"
          depthWrite={false}
          opacity={0.12}
          toneMapped={false}
          transparent
        />
      </mesh>

      <Sparkles
        color="#E9F1E2"
        count={28}
        opacity={0.2}
        scale={compactViewport ? [7, 8, 3] : [10, 6, 4]}
        size={0.5}
        speed={animate ? 0.08 : 0}
      />
    </group>
  );
}
