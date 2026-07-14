import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import {
  CryptoMarketSchema,
  type GetMarketsRequest,
  type GetMarketsResponse,
  GetMarketsResponseSchema,
  TradingService,
} from '@packages/protocol';
import { ZGetCryptoMarketsRequest } from '@/adapters/connect/get-crypto-markets.schema';
import type { GetCryptoMarkets } from '@/application/get-crypto-markets/get-crypto-markets.port';
import { CoinId } from '@/domain/crypto-market/coin-id';
import { MarketDataUnavailableError } from '@/domain/crypto-market/errors';
import { QuoteCurrency } from '@/domain/crypto-market/quote-currency';

/**
 * Inbound Connect adapter: validate wire input, invoke the application use
 * case, then map domain models/errors to the public RPC protocol.
 */
export const createGetCryptoMarketsHandler =
  (getCryptoMarkets: GetCryptoMarkets) =>
  async (request: GetMarketsRequest): Promise<GetMarketsResponse> => {
    const parsed = ZGetCryptoMarketsRequest.safeParse({
      coinIds: request.coinIds,
      vsCurrency: request.vsCurrency || 'usd',
    });
    if (!parsed.success) {
      throw new ConnectError(
        parsed.error.issues[0]?.message ?? 'Invalid market request',
        Code.InvalidArgument,
      );
    }

    try {
      const quoteCurrency = QuoteCurrency.create(parsed.data.vsCurrency);
      const markets = await getCryptoMarkets.execute({
        coinIds: parsed.data.coinIds.map(CoinId.create),
        quoteCurrency,
      });
      return create(GetMarketsResponseSchema, {
        markets: markets.map((market) =>
          create(CryptoMarketSchema, market.toPrimitives()),
        ),
        vsCurrency: quoteCurrency.value,
      });
    } catch (error) {
      if (error instanceof MarketDataUnavailableError) {
        throw new ConnectError(
          'Crypto market data is unavailable',
          Code.Unavailable,
        );
      }
      throw new ConnectError(
        'Unable to retrieve crypto market data',
        Code.Internal,
      );
    }
  };

/** Registers the service-owned TradingService RPC methods. */
export const createTradingServiceRoutes =
  (getCryptoMarkets: GetCryptoMarkets) =>
  (router: ConnectRouter): void => {
    router.service(TradingService, {
      getMarkets: createGetCryptoMarketsHandler(getCryptoMarkets),
    });
  };
