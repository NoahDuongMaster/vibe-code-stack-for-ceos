import { getHealthAPI } from '../adapters/health.adapter';

/**
 * Business logic for the health slice. Thin today, but this is where retries,
 * polling, or aggregation across services would live.
 */
export const healthService = {
  check: () => getHealthAPI(),
};
