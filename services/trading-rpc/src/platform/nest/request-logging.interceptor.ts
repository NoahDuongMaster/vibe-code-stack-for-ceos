import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = performance.now();
    const operation = `${context.getClass().name}.${context.getHandler().name}`;
    const transport = context.getType<string>();
    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.debug({
            durationMs: Math.round(performance.now() - startedAt),
            operation,
            transport,
          });
        },
        error: (error: unknown) => {
          this.logger.error({
            durationMs: Math.round(performance.now() - startedAt),
            error,
            operation,
            transport,
          });
        },
      }),
    );
  }
}
