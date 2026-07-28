export interface TAdminIdentity {
  id: string;
  email: string;
  name: string;
}

export interface CredentialVerifier {
  verify(email: string, password: string): Promise<TAdminIdentity | null>;
}

export interface AccessTokenIssuer {
  issue(identity: TAdminIdentity): Promise<string>;
}
