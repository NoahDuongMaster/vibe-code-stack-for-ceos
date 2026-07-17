'use client';

import dynamic from 'next/dynamic';
import type { TMarketSceneProps } from '@/_pages/home/ui/market-scene';
import { MarketSceneFallback } from '@/_pages/home/ui/market-scene-fallback';

const MarketScene = dynamic<TMarketSceneProps>(
  () =>
    import('@/_pages/home/ui/market-scene').then(
      (module) => module.MarketScene,
    ),
  {
    ssr: false,
    loading: () => <MarketSceneFallback />,
  },
);

export function MarketSceneLoader(props: TMarketSceneProps) {
  return <MarketScene {...props} />;
}
