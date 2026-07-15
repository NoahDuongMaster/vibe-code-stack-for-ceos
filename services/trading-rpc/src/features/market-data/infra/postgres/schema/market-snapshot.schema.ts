import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const marketDataSchema = pgSchema('market_data');

export const marketSnapshots = marketDataSchema.table(
  'market_snapshots',
  {
    coinId: text('coin_id').notNull(),
    quoteCurrency: text('quote_currency').notNull(),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),
    imageUrl: text('image_url'),
    currentPrice: doublePrecision('current_price'),
    marketCap: doublePrecision('market_cap'),
    marketCapRank: integer('market_cap_rank'),
    priceChange24h: doublePrecision('price_change_24h'),
    priceChangePercentage24h: doublePrecision('price_change_percentage_24h'),
    totalVolume: doublePrecision('total_volume'),
    sourceUpdatedAt: timestamp('source_updated_at', {
      mode: 'date',
      withTimezone: true,
    }),
    persistedAt: timestamp('persisted_at', {
      mode: 'date',
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.coinId, table.quoteCurrency] }),
    check(
      'market_snapshots_coin_id_not_blank',
      sql`LENGTH(BTRIM(${table.coinId})) > 0`,
    ),
    check(
      'market_snapshots_quote_currency_not_blank',
      sql`LENGTH(BTRIM(${table.quoteCurrency})) > 0`,
    ),
    check(
      'market_snapshots_symbol_not_blank',
      sql`LENGTH(BTRIM(${table.symbol})) > 0`,
    ),
    check(
      'market_snapshots_name_not_blank',
      sql`LENGTH(BTRIM(${table.name})) > 0`,
    ),
    check(
      'market_snapshots_rank_positive',
      sql`${table.marketCapRank} IS NULL OR ${table.marketCapRank} > 0`,
    ),
  ],
);

export const marketDataDatabaseSchema = { marketSnapshots } as const;

export type TMarketSnapshotInsert = typeof marketSnapshots.$inferInsert;
export type TMarketSnapshotRow = typeof marketSnapshots.$inferSelect;
