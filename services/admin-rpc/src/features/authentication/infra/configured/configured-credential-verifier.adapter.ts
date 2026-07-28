import { createHash, timingSafeEqual } from 'node:crypto';
import type {
  CredentialVerifier,
  TAdminIdentity,
} from '@/features/authentication/domain/authentication.port';

export interface TConfiguredCredentialVerifierOptions {
  email: string;
  password: string;
  identity: TAdminIdentity;
}

const digest = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

export const createConfiguredCredentialVerifier = (
  options: TConfiguredCredentialVerifierOptions,
): CredentialVerifier => ({
  async verify(email, password) {
    const emailMatches = timingSafeEqual(digest(email), digest(options.email));
    const passwordMatches = timingSafeEqual(
      digest(password),
      digest(options.password),
    );
    return emailMatches && passwordMatches ? options.identity : null;
  },
});
