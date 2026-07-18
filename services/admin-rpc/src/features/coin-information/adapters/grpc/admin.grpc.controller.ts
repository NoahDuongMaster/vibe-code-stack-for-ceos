import { Controller, Inject, UseFilters } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import { AdminGrpcExceptionFilter } from '@/features/coin-information/adapters/grpc/admin.grpc-exception.filter';
import {
  GetMarketsGrpcPipe,
  type TGetMarketsGrpcRequest,
} from '@/features/coin-information/adapters/grpc/get-markets.grpc.pipe';
import type { GetMarkets } from '@/features/coin-information/application/get-markets.port';
import { GET_MARKETS } from '@/features/coin-information/coin-information.tokens';
import type { TCoinMarket } from '@/features/coin-information/domain/coin-market';

interface TGetMarketsGrpcResponse {
  markets: TCoinMarket[];
  vsCurrency: string;
}

@Controller()
@UseFilters(AdminGrpcExceptionFilter)
export class AdminGrpcController {
  private readonly getMarkets: GetMarkets;

  constructor(@Inject(GET_MARKETS) _getMarkets: GetMarkets) {
    this.getMarkets = _getMarkets;
  }

  @GrpcMethod('AdminService', 'GetMarkets')
  async getMarketsRpc(
    @Payload(GetMarketsGrpcPipe) _request: TGetMarketsGrpcRequest,
  ): Promise<TGetMarketsGrpcResponse> {
    return this.getMarkets.execute(_request);
  }
}
