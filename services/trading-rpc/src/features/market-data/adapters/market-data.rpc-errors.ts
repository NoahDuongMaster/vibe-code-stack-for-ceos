/** Stable public RPC messages shared by Connect and native gRPC adapters. */
export const MARKET_DATA_RPC_ERROR_MESSAGES = {
  internal: 'Unable to retrieve crypto market data',
  invalidRequest: 'Invalid market request',
  unavailable: 'Crypto market data is unavailable',
} as const;
