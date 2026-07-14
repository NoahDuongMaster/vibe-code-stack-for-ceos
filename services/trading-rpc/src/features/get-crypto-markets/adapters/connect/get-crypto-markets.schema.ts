import { z } from 'zod';

const ZCoinId = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, 'coinIds must contain crypto asset IDs');

/** Semantic validation at the Connect-RPC trust boundary. */
export const ZGetCryptoMarketsRequest = z.object({
  coinIds: z.array(ZCoinId).min(1).max(50),
  vsCurrency: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3,10}$/),
});
