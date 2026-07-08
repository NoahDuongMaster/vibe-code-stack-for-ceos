export type TAuthErrorCode = 'invalid_credentials' | 'request_failed';

/** Typed error the auth adapter throws so callers can discriminate on `code`. */
export class AuthError extends Error {
  readonly code: TAuthErrorCode;

  constructor(code: TAuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
