import type { ConnectRouter } from '@connectrpc/connect';
import { ApiService } from '@packages/protocol';
import { healthHandler } from '../../features/health';
import type { ApiConfig } from '../../shared/config';

/**
 * Composes every feature slice's handler into the ApiService routes. This is the
 * one place that knows the full set of features — register a new slice's handler
 * here. Runtime-agnostic: the same routes run on Node and Cloudflare Workers,
 * each supplying only config + its runtime adapter.
 */
export function createRoutes(config: ApiConfig) {
  return (router: ConnectRouter) => {
    router.service(ApiService, {
      health: healthHandler(config),
    });
  };
}
