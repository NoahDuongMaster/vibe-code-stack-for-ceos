export type TAuthErrorCode = 'mock_auth_disabled' | 'invalid_credentials';

/** Typed error the login API throws so callers can discriminate on `code`. */
export class AuthError extends Error {
  readonly code: TAuthErrorCode;

  constructor(code: TAuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
