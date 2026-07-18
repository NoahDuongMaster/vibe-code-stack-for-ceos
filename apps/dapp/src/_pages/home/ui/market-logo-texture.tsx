'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  type MeshBasicMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three';

export const createSymbolLogoTexture = (symbol: string): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (context) {
    context.fillStyle = '#080A0B';
    context.beginPath();
    context.arc(64, 64, 62, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#E9F1E2';
    context.font = '700 38px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(symbol.slice(0, 2).toUpperCase(), 64, 66);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

export function MarketLogoTexture({
  imageUrl,
  radius,
  symbol,
}: {
  imageUrl?: string;
  radius: number;
  symbol: string;
}) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const fallback = useMemo(() => createSymbolLogoTexture(symbol), [symbol]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    let disposed = false;
    let remoteTexture: Texture | undefined;
    material.map = fallback;
    material.needsUpdate = true;

    if (imageUrl) {
      new TextureLoader().setCrossOrigin('anonymous').load(
        imageUrl,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = SRGBColorSpace;
          remoteTexture = texture;
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        () => {
          if (!disposed) {
            material.map = fallback;
            material.needsUpdate = true;
          }
        },
      );
    }

    return () => {
      disposed = true;
      remoteTexture?.dispose();
      material.map = null;
    };
  }, [fallback, imageUrl]);

  useEffect(() => () => fallback.dispose(), [fallback]);

  return (
    <mesh
      name={`market-logo-${symbol}`}
      position={[0, 0, radius * 1.015]}
      renderOrder={3}
    >
      <circleGeometry args={[radius * 0.52, 48]} />
      <meshBasicMaterial
        ref={materialRef}
        depthWrite={false}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}
