import { status } from '@grpc/grpc-js';
import {
  type ArgumentsHost,
  Catch,
  type RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { type Observable, throwError } from 'rxjs';
import { MARKET_DATA_RPC_ERROR_MESSAGES } from '@/features/market-data/adapters/market-data.rpc-errors';
import { MarketDataUnavailableError } from '@/features/market-data/domain/errors';

@Catch()
export class TradingGrpcExceptionFilter implements RpcExceptionFilter<unknown> {
  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }
    if (exception instanceof MarketDataUnavailableError) {
      return throwError(() => ({
        code: status.UNAVAILABLE,
        message: MARKET_DATA_RPC_ERROR_MESSAGES.unavailable,
      }));
    }
    return throwError(() => ({
      code: status.INTERNAL,
      message: MARKET_DATA_RPC_ERROR_MESSAGES.internal,
    }));
  }
}
