import type { TEchoInput, TEchoResult } from './echo.schema';

/**
 * Business logic for Echo — transport-agnostic and pure, so it is unit-testable
 * without Connect or a running server. Owns the "what", not "how it arrives".
 */
export const echoService = {
  echo(input: TEchoInput): TEchoResult {
    return {
      message: input.message,
      upper: input.message.toUpperCase(),
      length: input.message.length,
    };
  },
};
