import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

const environmentFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(environmentFile)) loadEnvFile(environmentFile);

const databaseUrl = z.url().parse(process.env.DATABASE_URL);

export default defineConfig({
  dialect: 'postgresql',
  schema:
    './src/features/market-data/infra/postgres/schema/market-snapshot.schema.ts',
  out: './src/features/market-data/infra/postgres/migrations',
  dbCredentials: { url: databaseUrl },
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_migrations',
  },
  strict: true,
  verbose: true,
});
