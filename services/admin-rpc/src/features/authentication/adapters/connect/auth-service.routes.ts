import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import {
  AuthService,
  AuthUserSchema,
  type LoginRequest,
  type LoginResponse,
  LoginResponseSchema,
} from '@packages/protocol';
import { AUTHENTICATION_RPC_ERROR_MESSAGES } from '@/features/authentication/adapters/authentication.rpc-errors';
import { ZLoginRequest } from '@/features/authentication/adapters/login.schema';
import type { Login } from '@/features/authentication/application/login.port';
import { InvalidCredentialsError } from '@/features/authentication/domain/errors';

export const createLoginHandler =
  (login: Login) =>
  async (request: LoginRequest): Promise<LoginResponse> => {
    const parsed = ZLoginRequest.safeParse(request);
    if (!parsed.success) {
      throw new ConnectError(
        AUTHENTICATION_RPC_ERROR_MESSAGES.invalidRequest,
        Code.InvalidArgument,
      );
    }

    try {
      const result = await login.execute(parsed.data);
      return create(LoginResponseSchema, {
        token: result.token,
        user: create(AuthUserSchema, result.user),
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new ConnectError(
          AUTHENTICATION_RPC_ERROR_MESSAGES.invalidCredentials,
          Code.Unauthenticated,
        );
      }
      throw new ConnectError(
        AUTHENTICATION_RPC_ERROR_MESSAGES.internal,
        Code.Internal,
      );
    }
  };

export const createAuthServiceRoutes =
  (login: Login) =>
  (router: ConnectRouter): void => {
    router.service(AuthService, { login: createLoginHandler(login) });
  };
