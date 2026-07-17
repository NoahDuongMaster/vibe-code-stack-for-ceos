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
import { css } from '@/styled-system/css';
import { grid } from '@/styled-system/patterns';

const EMPTY_MARKETS: TMarket[] = [];

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
        onRefresh={() => void query.refetch()}
        status={status}
      />

      <div
        className={grid({
          columns: { base: 1, xl: 12 },
          gap: '5',
          mt: '7',
        })}
      >
        <div className={css({ gridColumn: { xl: 'span 8' } })}>
          <MarketSceneLoader
            activeMarketId={activeMarketId}
            markets={markets}
            nodes={sceneNodes}
            onActiveMarketChange={setRequestedMarketId}
          />
        </div>
        <aside
          className={css({
            gridColumn: { xl: 'span 4' },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            p: { base: '5', md: '7' },
            bgColor: 'rgba(13, 25, 35, 0.78)',
            borderWidth: '1px',
            borderColor: 'rgba(167, 139, 250, 0.24)',
            rounded: '2xl',
          })}
        >
          <p
            className={css({
              color: '#a78bfa',
              fontFamily: 'mono',
              fontSize: 'xs',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            })}
          >
            Scene telemetry
          </p>
          <p
            className={css({
              mt: '3',
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              letterSpacing: '-0.04em',
              lineHeight: '1.1',
            })}
          >
            Market cap controls mass. Momentum controls glow.
          </p>
          <p className={css({ mt: '4', color: '#91a9b4', lineHeight: '1.7' })}>
            Cyan bodies are gaining, coral bodies are losing, and violet marks
            neutral or unavailable change.
          </p>
        </aside>
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
