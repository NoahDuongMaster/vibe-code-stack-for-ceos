import { Controller, Get } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';

@Controller()
export class HealthController {
  @Get('/healthz')
  @RouteConfig({ rateLimit: false })
  health() {
    return { status: 'ok' as const };
  }
}
