import { type DynamicModule, Module } from '@nestjs/common';
import { TradingGrpcController } from '@/features/market-data/adapters/grpc/trading.grpc.controller';
import { GetMarketsUseCase } from '@/features/market-data/application/get-markets.use-case';
import type { MarketDataProvider } from '@/features/market-data/domain/market-data-provider.port';
import type { MarketSnapshotRepository } from '@/features/market-data/domain/market-snapshot.repository.port';
import {
  GET_MARKETS,
  MARKET_DATA_PROVIDER,
  MARKET_SNAPSHOT_REPOSITORY,
} from '@/features/market-data/market-data.tokens';

export interface TMarketDataModuleOptions {
  marketDataProvider: MarketDataProvider;
  marketSnapshotRepository: MarketSnapshotRepository;
}

/** Feature-local Nest composition. Domain and application remain framework-free. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules expose configuration through a static register factory.
export class MarketDataModule {
  static register(options: TMarketDataModuleOptions): DynamicModule {
    return {
      module: MarketDataModule,
      controllers: [TradingGrpcController],
      providers: [
        {
          provide: MARKET_DATA_PROVIDER,
          useValue: options.marketDataProvider,
        },
        {
          provide: MARKET_SNAPSHOT_REPOSITORY,
          useValue: options.marketSnapshotRepository,
        },
        {
          provide: GET_MARKETS,
          useFactory: (
            provider: MarketDataProvider,
            repository: MarketSnapshotRepository,
          ) => new GetMarketsUseCase(provider, repository),
          inject: [MARKET_DATA_PROVIDER, MARKET_SNAPSHOT_REPOSITORY],
        },
      ],
      exports: [GET_MARKETS],
    };
  }
}
