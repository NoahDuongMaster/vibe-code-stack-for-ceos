import { createClient, createRouterTransport } from '@connectrpc/connect';
import { createRoutes } from '@packages/api-core';
import { ApiService } from '@packages/protocol';
import { parseRuntimeConfig } from '@/config/runtime-config';

/**
 * RPC smoke test — proves the typed Connect client works end-to-end WITHOUT a
 * running server (createRouterTransport dispatches in-memory).
 * Run: pnpm --filter @services/trading-rpc rpc:smoke
 */
const config = parseRuntimeConfig(process.env);
const transport = createRouterTransport(
  createRoutes({ serviceName: config.serviceName, runtime: 'node' }),
);
const client = createClient(ApiService, transport);

const writeOutput = (label: string, value: unknown): void => {
  process.stdout.write(`${label} → ${JSON.stringify(value)}\n`);
};

async function main() {
  // Health — response is fully typed from the proto contract.
  const health = await client.health({});
  writeOutput('Health', health);

  if (
    health.status !== 'ok' ||
    health.service !== config.serviceName ||
    health.runtime !== 'node'
  ) {
    throw new Error('RPC smoke FAILED: unexpected response');
  }
  process.stdout.write('✅ Connect RPC smoke passed (types + runtime)\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
