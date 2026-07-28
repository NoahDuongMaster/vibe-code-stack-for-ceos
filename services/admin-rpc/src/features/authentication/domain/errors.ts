export class InvalidCredentialsError extends Error {
  override readonly name = 'InvalidCredentialsError';

  constructor() {
    super('Invalid credentials');
  }
}
