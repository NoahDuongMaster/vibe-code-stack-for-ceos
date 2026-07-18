'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createMarketSummary } from '@/_pages/home/model/market.mapper';
import type { TMarket } from '@/_pages/home/model/market.schema';
import { mapMarketsToBubbles } from '@/_pages/home/model/market-scene.mapper';
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
  alignItems: 'stretch',
  h: { xl: 'clamp(34rem, 62vh, 46rem)' },
});

const dashboardStyle = css({
  position: 'relative',
  zIndex: 1,
  w: 'full',
  maxW: '1800px',
  mx: 'auto',
  px: { base: '3', md: '4', xl: '6' },
  py: { base: '3', md: '6' },
  animation: 'terminalReveal 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
  _motionReduce: { animation: 'none' },
});

const reactorSceneStageStyle = css({
  gridColumn: { xl: 'span 9' },
  h: { base: '28rem', md: '32rem', xl: 'full' },
  minW: 0,
  '& > *': { h: 'full' },
});

const reactorWatchStageStyle = css({
  gridColumn: { xl: 'span 3' },
  minH: 0,
  h: { xl: 'full' },
  '& > section': { h: { xl: 'full' } },
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
  const sceneNodes = useMemo(() => mapMarketsToBubbles(markets), [markets]);

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
    <div className={dashboardStyle}>
      <MarketHeader
        lastUpdatedAt={query.dataUpdatedAt || undefined}
        markets={markets}
        onRefresh={() => void query.refetch()}
        status={status}
      />

      <div className={reactorGridStyle}>
        <div className={reactorSceneStageStyle}>
          <MarketSceneLoader
            activeMarketId={activeMarketId}
            markets={markets}
            nodes={sceneNodes}
            onActiveMarketChange={setRequestedMarketId}
          />
        </div>
        <div className={reactorWatchStageStyle}>
          <MarketWatchlist
            activeMarketId={activeMarketId}
            markets={markets}
            onActiveMarketChange={setRequestedMarketId}
          />
        </div>
      </div>

      <div className={css({ mt: '3' })}>
        {isStale ? <MarketStaleNotice /> : null}
        {!query.data && query.isError ? (
          <MarketErrorState onRetry={() => void query.refetch()} />
        ) : null}
      </div>

      <div className={css({ mt: '3' })}>
        {!query.data && (query.isPending || query.isFetching) ? (
          <MarketLoadingState />
        ) : (
          <MarketMetrics summary={summary} />
        )}
      </div>

      {query.data ? (
        <div className={css({ mt: '6' })}>
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
