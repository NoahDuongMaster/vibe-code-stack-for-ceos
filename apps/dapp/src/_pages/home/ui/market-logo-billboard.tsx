'use client';

import { Html } from '@react-three/drei';
import { MarketLogo } from '@/_pages/home/ui/market-logo';

export function MarketLogoBillboard({
  imageUrl,
  name,
  radius,
  symbol,
}: {
  imageUrl?: string;
  name: string;
  radius: number;
  symbol: string;
}) {
  return (
    <Html
      center
      distanceFactor={3.8}
      pointerEvents="none"
      position={[0, 0, radius * 1.04]}
      sprite
      transform
      zIndexRange={[20, 0]}
    >
      <MarketLogo imageUrl={imageUrl} name={name} size={40} symbol={symbol} />
    </Html>
  );
}
