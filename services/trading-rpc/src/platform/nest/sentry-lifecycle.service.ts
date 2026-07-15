import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await Sentry.close(2_000);
  }
}
