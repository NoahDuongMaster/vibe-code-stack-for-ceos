import { type DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiGrpcController } from '@/adapters/grpc/api.grpc.controller';
import { HealthController } from '@/adapters/http/health.controller';
import {
  MarketDataModule,
  type TMarketDataModuleOptions,
} from '@/features/market-data';
import { RequestLoggingInterceptor } from '@/platform/nest/request-logging.interceptor';
import { SentryLifecycleService } from '@/platform/nest/sentry-lifecycle.service';
import { SERVICE_NAME } from '@/platform/nest/trading-rpc.tokens';

export interface TTradingRpcModuleOptions extends TMarketDataModuleOptions {
  serviceName: string;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules expose configuration through a static register factory.
export class TradingRpcModule {
  static register(options: TTradingRpcModuleOptions): DynamicModule {
    return {
      module: TradingRpcModule,
      imports: [MarketDataModule.register(options)],
      controllers: [ApiGrpcController, HealthController],
      providers: [
        SentryLifecycleService,
        {
          provide: SERVICE_NAME,
          useValue: options.serviceName,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: RequestLoggingInterceptor,
        },
      ],
    };
  }
}
