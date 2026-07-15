/** Driven port for verifying a bearer token without exposing JWT tooling inward. */
export interface TokenVerifier {
  verify(token: string, secret: string): Promise<boolean>;
}
