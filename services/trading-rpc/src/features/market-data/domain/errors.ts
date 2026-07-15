export abstract class CryptoMarketDomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidCoinIdError extends CryptoMarketDomainError {
  readonly code = 'invalid_coin_id';

  constructor() {
    super('Coin ID is invalid');
  }
}

export class InvalidQuoteCurrencyError extends CryptoMarketDomainError {
  readonly code = 'invalid_quote_currency';

  constructor() {
    super('Quote currency is invalid');
  }
}

export class InvalidMarketSnapshotError extends CryptoMarketDomainError {
  readonly code = 'invalid_market_snapshot';

  constructor() {
    super('Market snapshot is invalid');
  }
}

/** Safe domain-level representation of an unavailable external data source. */
export class MarketDataUnavailableError extends CryptoMarketDomainError {
  readonly code = 'market_data_unavailable';

  constructor() {
    super('Market data is unavailable');
  }
}
