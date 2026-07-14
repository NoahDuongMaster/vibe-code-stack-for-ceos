import { createClient, createRouterTransport } from '@connectrpc/connect';
import { createRoutes } from '@packages/api-core';
import { ApiService } from '@packages/protocol';

/**
 * RPC smoke test — proves the typed Connect client works end-to-end WITHOUT a
 * running server (createRouterTransport dispatches in-memory).
 * Run: pnpm --filter @services/trading-rpc rpc:smoke
 */
const transport = createRouterTransport(
  createRoutes({ serviceName: 'api-node', runtime: 'node' }),
);
const client = createClient(ApiService, transport);

const writeOutput = (label: string, value: unknown): void => {
  process.stdout.write(`${label} → ${JSON.stringify(value)}\n`);
};

async function main() {
  // Health — response is fully typed from the proto contract.
  const health = await client.health({});
  writeOutput('Health', health);

  // Echo — request is type-checked against EchoRequest.
  const echo = await client.echo({ message: 'rpc works' });
  writeOutput('Echo', echo);

  if (echo.upper !== 'RPC WORKS' || echo.length !== 9) {
    throw new Error('RPC smoke FAILED: unexpected response');
  }
  process.stdout.write('✅ Connect RPC smoke passed (types + runtime)\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
