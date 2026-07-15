import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const assets = [
  {
    source: new URL('../../../packages/protocol/proto', import.meta.url),
    destination: new URL('../dist/proto', import.meta.url),
  },
  {
    source: new URL(
      '../src/features/market-data/infra/postgres/migrations',
      import.meta.url,
    ),
    destination: new URL('../dist/migrations', import.meta.url),
  },
];

for (const asset of assets) {
  const destination = fileURLToPath(asset.destination);
  await mkdir(destination, { recursive: true });
  await cp(fileURLToPath(asset.source), destination, { recursive: true });
}
