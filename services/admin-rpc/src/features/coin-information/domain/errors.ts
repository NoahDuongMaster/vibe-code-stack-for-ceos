export class CoinInformationUnavailableError extends Error {
  override readonly name = 'CoinInformationUnavailableError';

  constructor(options?: ErrorOptions) {
    super('Coin information is unavailable', options);
  }
}
