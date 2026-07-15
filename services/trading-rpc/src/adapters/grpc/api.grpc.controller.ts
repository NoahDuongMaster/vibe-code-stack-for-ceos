import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { healthService } from '@packages/api-core';
import { SERVICE_NAME } from '@/platform/nest/trading-rpc.tokens';

@Controller()
export class ApiGrpcController {
  constructor(@Inject(SERVICE_NAME) private readonly serviceName: string) {}

  @GrpcMethod('ApiService', 'Health')
  health() {
    return healthService.check(this.serviceName, 'node');
  }
}
