import { type DynamicModule, Module } from '@nestjs/common';
import { AuthGrpcController } from '@/features/authentication/adapters/grpc/auth.grpc.controller';
import { LoginUseCase } from '@/features/authentication/application/login.use-case';
import {
  ACCESS_TOKEN_ISSUER,
  CREDENTIAL_VERIFIER,
  LOGIN,
} from '@/features/authentication/authentication.tokens';
import type {
  AccessTokenIssuer,
  CredentialVerifier,
} from '@/features/authentication/domain/authentication.port';

export interface TAuthenticationModuleOptions {
  credentialVerifier: CredentialVerifier;
  accessTokenIssuer: AccessTokenIssuer;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules expose configuration through a static register factory.
export class AuthenticationModule {
  static register(options: TAuthenticationModuleOptions): DynamicModule {
    return {
      module: AuthenticationModule,
      controllers: [AuthGrpcController],
      providers: [
        { provide: CREDENTIAL_VERIFIER, useValue: options.credentialVerifier },
        { provide: ACCESS_TOKEN_ISSUER, useValue: options.accessTokenIssuer },
        {
          provide: LOGIN,
          useFactory: (
            credentialVerifier: CredentialVerifier,
            accessTokenIssuer: AccessTokenIssuer,
          ) => new LoginUseCase(credentialVerifier, accessTokenIssuer),
          inject: [CREDENTIAL_VERIFIER, ACCESS_TOKEN_ISSUER],
        },
      ],
      exports: [LOGIN],
    };
  }
}
