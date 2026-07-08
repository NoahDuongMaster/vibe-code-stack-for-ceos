// Public barrel — the ONLY surface importable from outside `features/health`.
export { HealthStatus } from './_components/health-status';
export type { THealthResponse } from './schemas/health.schema';
export { healthService } from './services/health.service';
