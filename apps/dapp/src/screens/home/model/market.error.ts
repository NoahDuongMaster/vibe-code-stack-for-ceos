export class MarketDataUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Market data is temporarily unavailable.', options);
    this.name = 'MarketDataUnavailableError';
  }
}
