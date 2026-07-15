import { verify } from 'hono/jwt';
import type { TokenVerifier } from '@/features/access-control/application/token-verifier.port';

/** Hono JWT driven adapter; verification failures are safe access denials. */
export const honoJwtTokenVerifier: TokenVerifier = {
  async verify(token: string, secret: string): Promise<boolean> {
    try {
      await verify(token, secret, 'HS256');
      return true;
    } catch {
      return false;
    }
  },
};
