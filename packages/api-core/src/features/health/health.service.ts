/** The Health service's transport-agnostic result. */
export interface THealthResult {
  status: 'ok';
  service: string;
  runtime: string;
}

/**
 * Business logic for Health — reports liveness plus which service and runtime
 * answered. Takes primitives (not ApiConfig) to stay decoupled from transport
 * config shape; pure and trivially unit-testable.
 */
export const healthService = {
  check(serviceName: string, runtime: string): THealthResult {
    return { status: 'ok', service: serviceName, runtime };
  },
};
