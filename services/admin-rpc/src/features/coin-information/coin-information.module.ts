import { type DynamicModule, Module } from '@nestjs/common';
import { AdminGrpcController } from '@/features/coin-information/adapters/grpc/admin.grpc.controller';
import { GetMarketsUseCase } from '@/features/coin-information/application/get-markets.use-case';
import {
  GET_MARKETS,
  TRADING_MARKET_DATA,
} from '@/features/coin-information/coin-information.tokens';
import type { TradingMarketData } from '@/features/coin-information/domain/trading-market-data.port';

export interface TCoinInformationModuleOptions {
  tradingMarketData: TradingMarketData;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules expose configuration through a static register factory.
export class CoinInformationModule {
  static register(options: TCoinInformationModuleOptions): DynamicModule {
    return {
      module: CoinInformationModule,
      controllers: [AdminGrpcController],
      providers: [
        {
          provide: TRADING_MARKET_DATA,
          useValue: options.tradingMarketData,
        },
        {
          provide: GET_MARKETS,
          useFactory: (tradingMarketData: TradingMarketData) =>
            new GetMarketsUseCase(tradingMarketData),
          inject: [TRADING_MARKET_DATA],
        },
      ],
      exports: [GET_MARKETS],
    };
  }
}
