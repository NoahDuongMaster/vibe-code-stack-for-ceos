'use client';

import dynamic from 'next/dynamic';
import type { TMarketSceneProps } from '@/_pages/home/ui/market-scene';
import { MarketSceneFallback } from '@/_pages/home/ui/market-scene-fallback';
import { MARKET_SCENE_SHELL_STYLE } from '@/_pages/home/ui/market-scene-shell';

const MarketScene = dynamic<TMarketSceneProps>(
  () =>
    import('@/_pages/home/ui/market-scene').then(
      (module) => module.MarketScene,
    ),
  {
    ssr: false,
    loading: () => (
      <div className={MARKET_SCENE_SHELL_STYLE}>
        <MarketSceneFallback />
      </div>
    ),
  },
);

export function MarketSceneLoader(props: TMarketSceneProps) {
  return <MarketScene {...props} />;
}
