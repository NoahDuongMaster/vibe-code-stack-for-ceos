import { SignJWT } from 'jose';
import type {
  AccessTokenIssuer,
  TAdminIdentity,
} from '@/features/authentication/domain/authentication.port';

export interface TJwtAccessTokenIssuerOptions {
  secret: string;
  ttlSeconds: number;
}

export const createJwtAccessTokenIssuer = (
  options: TJwtAccessTokenIssuerOptions,
): AccessTokenIssuer => {
  const key = new TextEncoder().encode(options.secret);

  return {
    issue(identity: TAdminIdentity): Promise<string> {
      return new SignJWT({ email: identity.email, name: identity.name })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(identity.id)
        .setIssuedAt()
        .setExpirationTime(`${options.ttlSeconds}s`)
        .sign(key);
    },
  };
};
