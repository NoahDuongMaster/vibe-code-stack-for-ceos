// Public surface of the health slice — the only import path other layers use.
export { healthHandler } from './health.handler';
export type { THealthResult } from './health.service';
export { healthService } from './health.service';
