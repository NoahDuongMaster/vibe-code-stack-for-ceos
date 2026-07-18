import { status } from '@grpc/grpc-js';
import { Injectable, type PipeTransform } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { COIN_INFORMATION_RPC_ERROR_MESSAGES } from '@/features/coin-information/adapters/coin-information.rpc-errors';
import { ZGetMarketsRequest } from '@/features/coin-information/adapters/get-markets.schema';

export interface TGetMarketsGrpcRequest {
  coinIds: string[];
  vsCurrency: string;
}

@Injectable()
export class GetMarketsGrpcPipe
  implements PipeTransform<unknown, TGetMarketsGrpcRequest>
{
  transform(value: unknown): TGetMarketsGrpcRequest {
    const request =
      typeof value === 'object' && value !== null
        ? {
            ...value,
            vsCurrency:
              'vsCurrency' in value && value.vsCurrency
                ? value.vsCurrency
                : 'usd',
          }
        : value;
    const parsed = ZGetMarketsRequest.safeParse(request);
    if (!parsed.success) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: COIN_INFORMATION_RPC_ERROR_MESSAGES.invalidRequest,
      });
    }
    return parsed.data;
  }
}
