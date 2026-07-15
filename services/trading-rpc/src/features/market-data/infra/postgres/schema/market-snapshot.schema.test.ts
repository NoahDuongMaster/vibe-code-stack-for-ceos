import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { marketSnapshots } from '@/features/market-data/infra/postgres/schema/market-snapshot.schema';

describe('marketSnapshots schema', () => {
  it('should declare the market_data table with its composite identity', () => {
    const config = getTableConfig(marketSnapshots);

    expect(config.schema).toBe('market_data');
    expect(config.name).toBe('market_snapshots');
    expect(config.columns.map((column) => column.name)).toEqual([
      'coin_id',
      'quote_currency',
      'symbol',
      'name',
      'image_url',
      'current_price',
      'market_cap',
      'market_cap_rank',
      'price_change_24h',
      'price_change_percentage_24h',
      'total_volume',
      'source_updated_at',
      'persisted_at',
    ]);
    expect(
      config.primaryKeys.map((key) => key.columns.map((column) => column.name)),
    ).toEqual([['coin_id', 'quote_currency']]);
  });
});
