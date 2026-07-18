'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createMarketSummary } from '@/_pages/home/model/market.mapper';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { mapMarketsToScene } from '@/_pages/home/model/market-scene.mapper';
import { useMarkets } from '@/_pages/home/model/use-markets';
import { MarketHeader } from '@/_pages/home/ui/market-header';
import { MarketMetrics } from '@/_pages/home/ui/market-metrics';
import { MarketSceneLoader } from '@/_pages/home/ui/market-scene-loader';
import {
  MarketErrorState,
  MarketLoadingState,
  MarketStaleNotice,
} from '@/_pages/home/ui/market-state';
import { MarketTable } from '@/_pages/home/ui/market-table';
import { MarketWatchlist } from '@/_pages/home/ui/market-watchlist';
import { css } from '@/styled-system/css';
import { grid } from '@/styled-system/patterns';

const EMPTY_MARKETS: TMarket[] = [];

const reactorGridStyle = grid({
  columns: { base: 1, xl: 12 },
  gap: '3',
  mt: '3',
});

export function MarketDashboard() {
  const query = useMarkets();
  const [requestedMarketId, setRequestedMarketId] = useState<TMarket['id']>();
  const reportedErrorAtRef = useRef(0);
  const markets = query.data?.markets ?? EMPTY_MARKETS;
  const isStale = Boolean(
    query.data && (query.isError || query.isRefetchError),
  );
  const activeMarketId = markets.some(({ id }) => id === requestedMarketId)
    ? requestedMarketId
    : markets[0]?.id;
  const summary = useMemo(
    () => (query.data ? createMarketSummary(query.data) : undefined),
    [query.data],
  );
  const sceneNodes = useMemo(() => mapMarketsToScene(markets), [markets]);

  useEffect(() => {
    if (query.error && query.errorUpdatedAt > reportedErrorAtRef.current) {
      reportedErrorAtRef.current = query.errorUpdatedAt;
      Sentry.captureException(query.error);
    }
  }, [query.error, query.errorUpdatedAt]);

  const status = isStale
    ? 'stale'
    : query.data && query.isFetching
      ? 'updating'
      : query.data
        ? 'live'
        : 'loading';

  return (
    <div
      className={css({
        w: 'full',
        maxW: '1600px',
        mx: 'auto',
        px: { base: '4', md: '8', xl: '12' },
        py: { base: '8', md: '12' },
      })}
    >
      <MarketHeader
        lastUpdatedAt={query.dataUpdatedAt || undefined}
        markets={markets}
        onRefresh={() => void query.refetch()}
        status={status}
      />

      <div className={reactorGridStyle}>
        <div className={css({ gridColumn: { xl: 'span 9' } })}>
          <MarketSceneLoader
            activeMarketId={activeMarketId}
            markets={markets}
            nodes={sceneNodes}
            onActiveMarketChange={setRequestedMarketId}
          />
        </div>
        <div className={css({ gridColumn: { xl: 'span 3' }, minH: 0 })}>
          <MarketWatchlist
            activeMarketId={activeMarketId}
            markets={markets}
            onActiveMarketChange={setRequestedMarketId}
          />
        </div>
      </div>

      <div className={css({ mt: '5' })}>
        {isStale ? <MarketStaleNotice /> : null}
        {!query.data && query.isError ? (
          <MarketErrorState onRetry={() => void query.refetch()} />
        ) : null}
      </div>

      <div className={css({ mt: '5' })}>
        {!query.data && (query.isPending || query.isFetching) ? (
          <MarketLoadingState />
        ) : (
          <MarketMetrics summary={summary} />
        )}
      </div>

      {query.data ? (
        <div className={css({ mt: '12' })}>
          <MarketTable
            activeMarketId={activeMarketId}
            markets={markets}
            onActiveMarketChange={setRequestedMarketId}
          />
        </div>
      ) : null}
    </div>
  );
}
