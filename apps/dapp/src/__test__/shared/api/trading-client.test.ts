import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTradingClient: vi.fn(() => ({ getMarkets: vi.fn() })),
}));

vi.mock('@packages/api-client', () => ({
  createTradingClient: mocks.createTradingClient,
}));
vi.mock('@/shared/config', () => ({
  env: { client: { NEXT_PUBLIC_API_ENDPOINT: 'http://gateway.test' } },
}));

describe('[TradingClientConfiguration]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should lazily reuse a typed client configured with the validated gateway URL', async () => {
    const { getTradingClient } = await import('@/shared/api');

    expect(mocks.createTradingClient).not.toHaveBeenCalled();

    const firstClient = await getTradingClient();
    const secondClient = await getTradingClient();

    expect(mocks.createTradingClient).toHaveBeenCalledWith(
      'http://gateway.test',
    );
    expect(mocks.createTradingClient).toHaveBeenCalledOnce();
    expect(firstClient).toBe(secondClient);
  });
});
