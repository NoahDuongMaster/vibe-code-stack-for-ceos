export type TAuthErrorCode = 'invalid_credentials' | 'service_unavailable';

/** Typed error the login API throws so callers can discriminate on `code`. */
export class AuthError extends Error {
  readonly code: TAuthErrorCode;

  constructor(code: TAuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
