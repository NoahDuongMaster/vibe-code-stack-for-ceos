import { status } from '@grpc/grpc-js';
import {
  type ArgumentsHost,
  Catch,
  type RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { type Observable, throwError } from 'rxjs';
import { AUTHENTICATION_RPC_ERROR_MESSAGES } from '@/features/authentication/adapters/authentication.rpc-errors';
import { InvalidCredentialsError } from '@/features/authentication/domain/errors';

@Catch()
export class AuthGrpcExceptionFilter implements RpcExceptionFilter<unknown> {
  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }
    if (exception instanceof InvalidCredentialsError) {
      return throwError(() => ({
        code: status.UNAUTHENTICATED,
        message: AUTHENTICATION_RPC_ERROR_MESSAGES.invalidCredentials,
      }));
    }
    return throwError(() => ({
      code: status.INTERNAL,
      message: AUTHENTICATION_RPC_ERROR_MESSAGES.internal,
    }));
  }
}
