import { status } from '@grpc/grpc-js';
import {
  type ArgumentsHost,
  Catch,
  type RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { type Observable, throwError } from 'rxjs';
import { COIN_INFORMATION_RPC_ERROR_MESSAGES } from '@/features/coin-information/adapters/coin-information.rpc-errors';
import { CoinInformationUnavailableError } from '@/features/coin-information/domain/errors';

@Catch()
export class AdminGrpcExceptionFilter implements RpcExceptionFilter<unknown> {
  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }
    if (exception instanceof CoinInformationUnavailableError) {
      return throwError(() => ({
        code: status.UNAVAILABLE,
        message: COIN_INFORMATION_RPC_ERROR_MESSAGES.unavailable,
      }));
    }
    return throwError(() => ({
      code: status.INTERNAL,
      message: COIN_INFORMATION_RPC_ERROR_MESSAGES.internal,
    }));
  }
}
