import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { healthService } from '@packages/api-core';
import { SERVICE_NAME } from '@/platform/nest/admin-rpc.tokens';

@Controller()
export class HealthGrpcController {
  constructor(@Inject(SERVICE_NAME) private readonly serviceName: string) {}

  @GrpcMethod('HealthService', 'Health')
  health() {
    return healthService.check(this.serviceName, 'node');
  }
}
