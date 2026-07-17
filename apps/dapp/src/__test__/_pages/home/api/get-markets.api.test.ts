import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMarkets } from '@/_pages/home/api/get-markets.api';
import { MARKET_COIN_IDS } from '@/_pages/home/model/market.constants';
import { MarketDataUnavailableError } from '@/_pages/home/model/market.error';

const mocks = vi.hoisted(() => ({
  getMarkets: vi.fn(),
  getTradingClient: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  getTradingClient: mocks.getTradingClient,
}));
vi.mock('@/shared/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

describe('[GetMarketsApi]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTradingClient.mockResolvedValue({
      getMarkets: mocks.getMarkets,
    });
    mocks.getMarkets.mockResolvedValue({
      markets: [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          currentPrice: 70_000,
        },
      ],
      vsCurrency: 'usd',
    });
  });

  it('should request the fixed USD market set with cancellation', async () => {
    const controller = new AbortController();

    await expect(getMarkets(controller.signal)).resolves.toMatchObject({
      markets: [{ id: 'bitcoin', symbol: 'BTC' }],
      vsCurrency: 'usd',
    });
    expect(mocks.getMarkets).toHaveBeenCalledWith(
      { coinIds: [...MARKET_COIN_IDS], vsCurrency: 'usd' },
      { signal: controller.signal },
    );
  });

  it('should log the cause and expose only a safe unavailable error', async () => {
    const cause = new Error('private upstream detail');
    mocks.getMarkets.mockRejectedValue(cause);

    const promise = getMarkets();

    await expect(promise).rejects.toEqual(
      expect.objectContaining({
        name: 'MarketDataUnavailableError',
        message: 'Market data is temporarily unavailable.',
        cause,
      }),
    );
    await expect(promise).rejects.toBeInstanceOf(MarketDataUnavailableError);
    expect(mocks.loggerError).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith('[market-dashboard]', cause);
  });
});
