import { Code, ConnectError } from '@connectrpc/connect';
import type { EchoRequest } from '@packages/protocol';
import type { ApiConfig } from '../../shared/config';
import { ZEchoInput } from './echo.schema';
import { echoService } from './echo.service';

/**
 * Connect handler for Echo: validates input at the boundary, delegates to the
 * service, then maps the result onto the proto response. Zero business logic —
 * that lives in echoService.
 */
export function echoHandler(config: ApiConfig) {
  return (req: EchoRequest) => {
    const parsed = ZEchoInput.safeParse({ message: req.message });
    if (!parsed.success) {
      throw new ConnectError(
        parsed.error.issues[0]?.message ?? 'Invalid request',
        Code.InvalidArgument,
      );
    }

    const { message, upper, length } = echoService.echo(parsed.data);
    return { message, upper, length, runtime: config.runtime };
  };
}
