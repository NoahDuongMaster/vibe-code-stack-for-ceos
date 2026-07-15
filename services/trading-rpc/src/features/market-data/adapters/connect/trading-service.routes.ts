import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import {
  CryptoMarketSchema,
  type GetMarketsRequest,
  type GetMarketsResponse,
  GetMarketsResponseSchema,
  TradingService,
} from '@packages/protocol';
import { ZGetMarketsRequest } from '@/features/market-data/adapters/get-markets.schema';
import { MARKET_DATA_RPC_ERROR_MESSAGES } from '@/features/market-data/adapters/market-data.rpc-errors';
import type { GetMarkets } from '@/features/market-data/application/get-markets.port';
import { MarketDataUnavailableError } from '@/features/market-data/domain/errors';

/**
 * Inbound Connect adapter: validate wire input, invoke the application use
 * case, then map domain models/errors to the public RPC protocol.
 */
export const createGetMarketsHandler =
  (getMarkets: GetMarkets) =>
  async (request: GetMarketsRequest): Promise<GetMarketsResponse> => {
    const parsed = ZGetMarketsRequest.safeParse({
      coinIds: request.coinIds,
      vsCurrency: request.vsCurrency || 'usd',
    });
    if (!parsed.success) {
      throw new ConnectError(
        MARKET_DATA_RPC_ERROR_MESSAGES.invalidRequest,
        Code.InvalidArgument,
      );
    }

    try {
      const result = await getMarkets.execute({
        coinIds: parsed.data.coinIds,
        quoteCurrency: parsed.data.vsCurrency,
      });
      return create(GetMarketsResponseSchema, {
        markets: result.markets.map((market) =>
          create(CryptoMarketSchema, market.toPrimitives()),
        ),
        vsCurrency: result.quoteCurrency.value,
      });
    } catch (error) {
      if (error instanceof MarketDataUnavailableError) {
        throw new ConnectError(
          MARKET_DATA_RPC_ERROR_MESSAGES.unavailable,
          Code.Unavailable,
        );
      }
      throw new ConnectError(
        MARKET_DATA_RPC_ERROR_MESSAGES.internal,
        Code.Internal,
      );
    }
  };

/** Registers the service-owned TradingService RPC methods. */
export const createTradingServiceRoutes =
  (getMarkets: GetMarkets) =>
  (router: ConnectRouter): void => {
    router.service(TradingService, {
      getMarkets: createGetMarketsHandler(getMarkets),
    });
  };
