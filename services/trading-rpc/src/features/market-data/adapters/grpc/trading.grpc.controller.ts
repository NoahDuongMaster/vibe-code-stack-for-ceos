import { Controller, Inject, UseFilters } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import {
  GetMarketsGrpcPipe,
  type TGetMarketsGrpcRequest,
} from '@/features/market-data/adapters/grpc/get-markets.grpc.pipe';
import { TradingGrpcExceptionFilter } from '@/features/market-data/adapters/grpc/trading.grpc-exception.filter';
import type { GetMarkets } from '@/features/market-data/application/get-markets.port';
import type { MarketSnapshotPrimitives } from '@/features/market-data/domain/market-snapshot';
import { GET_MARKETS } from '@/features/market-data/market-data.tokens';

interface TGetMarketsGrpcResponse {
  markets: MarketSnapshotPrimitives[];
  vsCurrency: string;
}

@Controller()
@UseFilters(TradingGrpcExceptionFilter)
export class TradingGrpcController {
  private readonly getMarkets: GetMarkets;

  constructor(@Inject(GET_MARKETS) _getMarkets: GetMarkets) {
    this.getMarkets = _getMarkets;
  }

  @GrpcMethod('TradingService', 'GetMarkets')
  async getMarketsRpc(
    @Payload(GetMarketsGrpcPipe) _request: TGetMarketsGrpcRequest,
  ): Promise<TGetMarketsGrpcResponse> {
    const result = await this.getMarkets.execute({
      coinIds: _request.coinIds,
      quoteCurrency: _request.vsCurrency,
    });
    return {
      markets: result.markets.map((market) => market.toPrimitives()),
      vsCurrency: result.quoteCurrency.value,
    };
  }
}
