import { z } from 'zod';

export const ZGetMockQuery = z.object({
  delay: z.number().optional(),
  error: z.boolean().optional(),
});
type TGetMockQuery = z.infer<typeof ZGetMockQuery>;

export const ZGetMockResponse = z.object({ data: z.string() }); // TODO: Define the schema
type TGetMockResponse = z.infer<typeof ZGetMockResponse>;

export type { TGetMockQuery, TGetMockResponse };
