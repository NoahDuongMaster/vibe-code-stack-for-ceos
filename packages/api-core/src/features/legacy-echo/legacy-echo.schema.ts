import { z } from 'zod';

export const ZLegacyEchoInput = z.object({ message: z.string() });
export type TLegacyEchoInput = z.infer<typeof ZLegacyEchoInput>;
