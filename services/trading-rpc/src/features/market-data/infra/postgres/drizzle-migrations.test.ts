import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_FOLDER = new URL('./migrations/', import.meta.url);

describe('market-data Drizzle migrations', () => {
  it('should keep a generated migration journal and idempotent adoption SQL', async () => {
    const [journal, migration] = await Promise.all([
      readFile(new URL('meta/_journal.json', MIGRATIONS_FOLDER), 'utf8'),
      readFile(
        new URL('0000_create_market_snapshots.sql', MIGRATIONS_FOLDER),
        'utf8',
      ),
    ]);

    expect(JSON.parse(journal)).toMatchObject({
      dialect: 'postgresql',
      entries: [{ tag: '0000_create_market_snapshots' }],
    });
    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS "market_data"');
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "market_data"."market_snapshots"',
    );
  });
});
