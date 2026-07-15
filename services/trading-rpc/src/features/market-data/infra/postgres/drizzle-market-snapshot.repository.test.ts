import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { CoinId } from '@/features/market-data/domain/coin-id';
import { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';
import { QuoteCurrency } from '@/features/market-data/domain/quote-currency';
import { DrizzleMarketSnapshotRepository } from '@/features/market-data/infra/postgres/drizzle-market-snapshot.repository';
import {
  type marketDataDatabaseSchema,
  marketSnapshots,
} from '@/features/market-data/infra/postgres/schema/market-snapshot.schema';

const migrateMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('drizzle-orm/node-postgres/migrator', () => ({ migrate: migrateMock }));

const createPool = () => {
  const end = vi.fn(async () => undefined);
  const on = vi.fn();
  return {
    end,
    pool: { end, on } as unknown as Pool,
  };
};

interface TConflictConfig {
  target: unknown[];
  set: Record<string, unknown>;
}

const createDatabase = () => {
  const onConflictDoUpdate = vi.fn(
    async (_configuration: TConflictConfig) => undefined,
  );
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return {
    database: { insert } as unknown as NodePgDatabase<
      typeof marketDataDatabaseSchema
    >,
    insert,
    onConflictDoUpdate,
    values,
  };
};

describe('DrizzleMarketSnapshotRepository', () => {
  it('should apply generated Drizzle migrations during Nest bootstrap', async () => {
    const { database } = createDatabase();
    const { pool } = createPool();
    const repository = new DrizzleMarketSnapshotRepository(
      database,
      pool,
      '/runtime/drizzle',
    );

    await repository.onApplicationBootstrap();

    expect(migrateMock).toHaveBeenCalledWith(database, {
      migrationsFolder: '/runtime/drizzle',
    });
  });

  it('should execute one typed multi-row upsert for latest snapshots', async () => {
    const { database, insert, onConflictDoUpdate, values } = createDatabase();
    const { pool } = createPool();
    const repository = new DrizzleMarketSnapshotRepository(
      database,
      pool,
      '/runtime/drizzle',
    );
    const snapshots = [
      new MarketSnapshot({
        coinId: CoinId.create('bitcoin'),
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://images.example.com/bitcoin.png',
        currentPrice: 70_000,
        marketCap: 1_400_000_000_000,
        marketCapRank: 1,
        priceChange24h: 500,
        priceChangePercentage24h: 0.72,
        totalVolume: 20_000_000_000,
        lastUpdated: '2026-07-15T00:00:00.000Z',
      }),
      new MarketSnapshot({
        coinId: CoinId.create('ethereum'),
        symbol: 'eth',
        name: 'Ethereum',
      }),
    ];

    await repository.saveLatest(snapshots, QuoteCurrency.create('usd'));

    expect(insert).toHaveBeenCalledWith(marketSnapshots);
    expect(values).toHaveBeenCalledWith([
      {
        coinId: 'bitcoin',
        quoteCurrency: 'usd',
        symbol: 'btc',
        name: 'Bitcoin',
        imageUrl: 'https://images.example.com/bitcoin.png',
        currentPrice: 70_000,
        marketCap: 1_400_000_000_000,
        marketCapRank: 1,
        priceChange24h: 500,
        priceChangePercentage24h: 0.72,
        totalVolume: 20_000_000_000,
        sourceUpdatedAt: new Date('2026-07-15T00:00:00.000Z'),
      },
      {
        coinId: 'ethereum',
        quoteCurrency: 'usd',
        symbol: 'eth',
        name: 'Ethereum',
        imageUrl: null,
        currentPrice: null,
        marketCap: null,
        marketCapRank: null,
        priceChange24h: null,
        priceChangePercentage24h: null,
        totalVolume: null,
        sourceUpdatedAt: null,
      },
    ]);
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
    const conflict = onConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflict?.target).toEqual([
      marketSnapshots.coinId,
      marketSnapshots.quoteCurrency,
    ]);
    expect(Object.keys(conflict?.set ?? {}).sort()).toEqual(
      [
        'currentPrice',
        'imageUrl',
        'marketCap',
        'marketCapRank',
        'name',
        'persistedAt',
        'priceChange24h',
        'priceChangePercentage24h',
        'sourceUpdatedAt',
        'symbol',
        'totalVolume',
      ].sort(),
    );
  });

  it('should skip Drizzle when there are no snapshots to save', async () => {
    const { database, insert } = createDatabase();
    const { pool } = createPool();
    const repository = new DrizzleMarketSnapshotRepository(
      database,
      pool,
      '/runtime/drizzle',
    );

    await repository.saveLatest([], QuoteCurrency.create('usd'));

    expect(insert).not.toHaveBeenCalled();
  });

  it('should drain its node-postgres pool during Nest shutdown', async () => {
    const { database } = createDatabase();
    const { end, pool } = createPool();
    const repository = new DrizzleMarketSnapshotRepository(
      database,
      pool,
      '/runtime/drizzle',
    );

    await repository.onApplicationShutdown();

    expect(end).toHaveBeenCalledOnce();
  });
});
