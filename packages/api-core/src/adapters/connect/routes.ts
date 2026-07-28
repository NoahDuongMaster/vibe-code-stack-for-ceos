import type { ConnectRouter } from '@connectrpc/connect';
import { ApiService, HealthService } from '@packages/protocol';
import { healthHandler } from '../../features/health';
import { legacyEchoHandler } from '../../features/legacy-echo';
import type { ApiConfig } from '../../shared/config';

/** Registers the shared health capability for every supported runtime. */
export function createRoutes(config: ApiConfig) {
  return (router: ConnectRouter) => {
    router.service(HealthService, {
      health: healthHandler({
        serviceName: config.serviceName,
        runtime: config.runtime,
      }),
    });
    router.service(ApiService, {
      echo: legacyEchoHandler(config.runtime),
      health: healthHandler({
        serviceName: config.serviceName,
        runtime: config.runtime,
      }),
    });
  };
}
