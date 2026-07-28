import { ZLegacyEchoInput } from './legacy-echo.schema';
import { legacyEchoService } from './legacy-echo.service';

/** Compatibility handler for the deprecated api.v1.ApiService/Echo method. */
export const legacyEchoHandler = (runtime: string) => (input: unknown) =>
  legacyEchoService.echo(ZLegacyEchoInput.parse(input), runtime);
