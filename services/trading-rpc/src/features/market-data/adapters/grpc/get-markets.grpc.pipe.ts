import { status } from '@grpc/grpc-js';
import { Injectable, type PipeTransform } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ZGetMarketsRequest } from '@/features/market-data/adapters/get-markets.schema';
import { MARKET_DATA_RPC_ERROR_MESSAGES } from '@/features/market-data/adapters/market-data.rpc-errors';

export interface TGetMarketsGrpcRequest {
  coinIds: string[];
  vsCurrency: string;
}

@Injectable()
export class GetMarketsGrpcPipe
  implements PipeTransform<unknown, TGetMarketsGrpcRequest>
{
  transform(value: unknown): TGetMarketsGrpcRequest {
    const parsed = ZGetMarketsRequest.safeParse(value);
    if (!parsed.success) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: MARKET_DATA_RPC_ERROR_MESSAGES.invalidRequest,
      });
    }
    return {
      coinIds: parsed.data.coinIds,
      vsCurrency: parsed.data.vsCurrency,
    };
  }
}
