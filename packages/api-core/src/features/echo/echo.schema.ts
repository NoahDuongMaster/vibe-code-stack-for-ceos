import { z } from 'zod';

/**
 * Semantic validation at the RPC trust boundary. The proto already guarantees
 * `message` is a string; Zod adds the business rule (a sane upper bound). An
 * empty message is intentionally valid.
 */
export const ZEchoInput = z.object({
  message: z.string().max(1000, 'message must be 1000 characters or fewer'),
});
export type TEchoInput = z.infer<typeof ZEchoInput>;

/** The service's transport-agnostic result — no proto/Connect types leak here. */
export interface TEchoResult {
  message: string;
  upper: string;
  length: number;
}
