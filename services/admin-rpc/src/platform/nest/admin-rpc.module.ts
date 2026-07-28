import { type DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HealthGrpcController } from '@/adapters/grpc/health.grpc.controller';
import { HealthController } from '@/adapters/http/health.controller';
import {
  AuthenticationModule,
  type TAuthenticationModuleOptions,
} from '@/features/authentication';
import {
  CoinInformationModule,
  type TCoinInformationModuleOptions,
} from '@/features/coin-information';
import { SERVICE_NAME } from '@/platform/nest/admin-rpc.tokens';
import { RequestLoggingInterceptor } from '@/platform/nest/request-logging.interceptor';
import { SentryLifecycleService } from '@/platform/nest/sentry-lifecycle.service';

export interface TAdminRpcModuleOptions
  extends TCoinInformationModuleOptions,
    TAuthenticationModuleOptions {
  serviceName: string;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest dynamic modules expose configuration through a static register factory.
export class AdminRpcModule {
  static register(options: TAdminRpcModuleOptions): DynamicModule {
    return {
      module: AdminRpcModule,
      imports: [
        AuthenticationModule.register(options),
        CoinInformationModule.register(options),
      ],
      controllers: [HealthGrpcController, HealthController],
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
