import { healthService } from './health.service';

interface THealthHandlerConfig {
  serviceName: string;
  runtime: string;
}

/**
 * Connect handler for Health: no input to validate, so it just delegates to the
 * service. Zero business logic here.
 */
export function healthHandler(config: THealthHandlerConfig) {
  return () => healthService.check(config.serviceName, config.runtime);
}
