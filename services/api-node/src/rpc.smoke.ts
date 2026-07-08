import { createClient, createRouterTransport } from '@connectrpc/connect';
import { createRoutes } from '@repo/api-core';
import { ApiService } from '@repo/protocol';

/**
 * RPC smoke test — proves the typed Connect client works end-to-end WITHOUT a
 * running server (createRouterTransport dispatches in-memory).
 * Run: pnpm --filter @repo/api-node rpc:smoke
 */
const transport = createRouterTransport(
  createRoutes({ serviceName: 'api-node', runtime: 'node' }),
);
const client = createClient(ApiService, transport);

async function main() {
  // Health — response is fully typed from the proto contract.
  const health = await client.health({});
  console.log('Health →', health);

  // Echo — request is type-checked against EchoRequest.
  const echo = await client.echo({ message: 'rpc works' });
  console.log('Echo   →', echo);

  if (echo.upper !== 'RPC WORKS' || echo.length !== 9) {
    throw new Error('RPC smoke FAILED: unexpected response');
  }
  console.log('✅ Connect RPC smoke passed (types + runtime)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
