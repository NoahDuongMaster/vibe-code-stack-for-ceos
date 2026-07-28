import type { TLegacyEchoInput } from './legacy-echo.schema';

export interface TLegacyEchoResult {
  message: string;
  upper: string;
  length: number;
  runtime: string;
}

export const legacyEchoService = {
  echo(input: TLegacyEchoInput, runtime: string): TLegacyEchoResult {
    return {
      message: input.message,
      upper: input.message.toUpperCase(),
      length: input.message.length,
      runtime,
    };
  },
};
