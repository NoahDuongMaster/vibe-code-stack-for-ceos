import type {
  Login,
  TLoginInput,
  TLoginResult,
} from '@/features/authentication/application/login.port';
import type {
  AccessTokenIssuer,
  CredentialVerifier,
} from '@/features/authentication/domain/authentication.port';
import { InvalidCredentialsError } from '@/features/authentication/domain/errors';

export class LoginUseCase implements Login {
  constructor(
    private readonly credentialVerifier: CredentialVerifier,
    private readonly accessTokenIssuer: AccessTokenIssuer,
  ) {}

  async execute(input: TLoginInput): Promise<TLoginResult> {
    const identity = await this.credentialVerifier.verify(
      input.email,
      input.password,
    );
    if (!identity) throw new InvalidCredentialsError();

    return {
      token: await this.accessTokenIssuer.issue(identity),
      user: identity,
    };
  }
}
