// Public surface of the echo slice — the only import path other layers use.
export { echoHandler } from './echo.handler';
export type { TEchoInput, TEchoResult } from './echo.schema';
export { ZEchoInput } from './echo.schema';
export { echoService } from './echo.service';
