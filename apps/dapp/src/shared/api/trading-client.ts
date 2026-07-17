import type { TradingClient } from '@packages/api-client';

let tradingClientPromise: Promise<TradingClient> | undefined;

export const getTradingClient = (): Promise<TradingClient> => {
  tradingClientPromise ??= Promise.all([
    import('@packages/api-client'),
    import('@/shared/config'),
  ]).then(([{ createTradingClient }, { env }]) =>
    createTradingClient(env.client.NEXT_PUBLIC_API_ENDPOINT),
  );

  return tradingClientPromise;
};
