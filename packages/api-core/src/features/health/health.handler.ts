import type { ApiConfig } from '../../shared/config';
import { healthService } from './health.service';

/**
 * Connect handler for Health: no input to validate, so it just delegates to the
 * service. Zero business logic here.
 */
export function healthHandler(config: ApiConfig) {
  return () => healthService.check(config.serviceName, config.runtime);
}
