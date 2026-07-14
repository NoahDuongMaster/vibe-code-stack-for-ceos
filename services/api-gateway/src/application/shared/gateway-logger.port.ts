export type GatewayLogEvent =
  | {
      event: 'request_error';
      errorName: string;
      method: string;
      pathname: string;
      requestId: string | undefined;
    }
  | {
      event: 'rate_limiter_unavailable';
      errorName: string;
      requestId: string | undefined;
    };

/** Driven port for metadata-only gateway observability. */
export interface GatewayLogger {
  error(event: GatewayLogEvent): void;
  warning(event: GatewayLogEvent): void;
}
