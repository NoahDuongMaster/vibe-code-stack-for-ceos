// The health contract is defined once in the proto (@repo/protocol) and reaches
// us through the shared client — re-export the generated type as this slice's
// schema surface so consumers import it from the feature, not the transport.
export type { HealthResponse as THealthResponse } from '@repo/api-client';
