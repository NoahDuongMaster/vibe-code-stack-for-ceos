import { fileURLToPath } from 'node:url';
import {
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { MarketSnapshot } from '@/features/market-data/domain/market-snapshot';
import type { MarketSnapshotRepository } from '@/features/market-data/domain/market-snapshot.repository.port';
import type { QuoteCurrency } from '@/features/market-data/domain/quote-currency';
import {
  marketDataDatabaseSchema,
  marketSnapshots,
  type TMarketSnapshotInsert,
} from '@/features/market-data/infra/postgres/schema/market-snapshot.schema';

const DEFAULT_MIGRATIONS_FOLDER = fileURLToPath(
  new URL('./migrations', import.meta.url),
);

export interface TDrizzleMarketSnapshotRepositoryOptions {
  connectionString: string;
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  migrationsFolder?: string;
}

type TMarketDataDatabase = NodePgDatabase<typeof marketDataDatabaseSchema>;

/** Drizzle driven adapter with a Nest-managed node-postgres pool lifecycle. */
export class DrizzleMarketSnapshotRepository
  implements
    MarketSnapshotRepository,
    OnApplicationBootstrap,
    OnApplicationShutdown
{
  private readonly logger = new Logger(DrizzleMarketSnapshotRepository.name);

  constructor(
    private readonly database: TMarketDataDatabase,
    private readonly pool: Pool,
    private readonly migrationsFolder: string,
  ) {
    this.pool.on('error', (error) => {
      this.logger.error(
        'Unexpected error from an idle PostgreSQL client',
        error.stack,
      );
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await migrate(this.database, {
      migrationsFolder: this.migrationsFolder,
    });
    this.logger.log('Drizzle market-data repository is ready');
  }

  async saveLatest(
    snapshots: readonly MarketSnapshot[],
    quoteCurrency: QuoteCurrency,
  ): Promise<void> {
    if (snapshots.length === 0) return;

    const values: TMarketSnapshotInsert[] = snapshots.map((snapshot) => {
      const record = snapshot.toPrimitives();
      return {
        coinId: record.id,
        quoteCurrency: quoteCurrency.value,
        symbol: record.symbol,
        name: record.name,
        imageUrl: record.imageUrl ?? null,
        currentPrice: record.currentPrice ?? null,
        marketCap: record.marketCap ?? null,
        marketCapRank: record.marketCapRank ?? null,
        priceChange24h: record.priceChange24h ?? null,
        priceChangePercentage24h: record.priceChangePercentage24h ?? null,
        totalVolume: record.totalVolume ?? null,
        sourceUpdatedAt: record.lastUpdated
          ? new Date(record.lastUpdated)
          : null,
      };
    });

    await this.database
      .insert(marketSnapshots)
      .values(values)
      .onConflictDoUpdate({
        target: [marketSnapshots.coinId, marketSnapshots.quoteCurrency],
        set: {
          symbol: sql.raw(`excluded.${marketSnapshots.symbol.name}`),
          name: sql.raw(`excluded.${marketSnapshots.name.name}`),
          imageUrl: sql.raw(`excluded.${marketSnapshots.imageUrl.name}`),
          currentPrice: sql.raw(
            `excluded.${marketSnapshots.currentPrice.name}`,
          ),
          marketCap: sql.raw(`excluded.${marketSnapshots.marketCap.name}`),
          marketCapRank: sql.raw(
            `excluded.${marketSnapshots.marketCapRank.name}`,
          ),
          priceChange24h: sql.raw(
            `excluded.${marketSnapshots.priceChange24h.name}`,
          ),
          priceChangePercentage24h: sql.raw(
            `excluded.${marketSnapshots.priceChangePercentage24h.name}`,
          ),
          totalVolume: sql.raw(`excluded.${marketSnapshots.totalVolume.name}`),
          sourceUpdatedAt: sql.raw(
            `excluded.${marketSnapshots.sourceUpdatedAt.name}`,
          ),
          persistedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

export const createDrizzleMarketSnapshotRepository = (
  options: TDrizzleMarketSnapshotRepositoryOptions,
): MarketSnapshotRepository &
  OnApplicationBootstrap &
  OnApplicationShutdown => {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMs ?? 30_000,
  });
  const database = drizzle({
    client: pool,
    schema: marketDataDatabaseSchema,
  });
  return new DrizzleMarketSnapshotRepository(
    database,
    pool,
    options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER,
  );
};
