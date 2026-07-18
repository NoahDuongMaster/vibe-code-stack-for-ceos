import { create } from '@bufbuild/protobuf';
import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import {
  AdminService,
  type AdminServiceGetMarketsRequest,
  type AdminServiceGetMarketsResponse,
  AdminServiceGetMarketsResponseSchema,
  CryptoMarketSchema,
} from '@packages/protocol';
import { COIN_INFORMATION_RPC_ERROR_MESSAGES } from '@/features/coin-information/adapters/coin-information.rpc-errors';
import { ZGetMarketsRequest } from '@/features/coin-information/adapters/get-markets.schema';
import type { GetMarkets } from '@/features/coin-information/application/get-markets.port';
import { CoinInformationUnavailableError } from '@/features/coin-information/domain/errors';

export const createGetMarketsHandler =
  (getMarkets: GetMarkets) =>
  async (
    request: AdminServiceGetMarketsRequest,
  ): Promise<AdminServiceGetMarketsResponse> => {
    const parsed = ZGetMarketsRequest.safeParse({
      coinIds: request.coinIds,
      vsCurrency: request.vsCurrency || 'usd',
    });
    if (!parsed.success) {
      throw new ConnectError(
        COIN_INFORMATION_RPC_ERROR_MESSAGES.invalidRequest,
        Code.InvalidArgument,
      );
    }

    try {
      const result = await getMarkets.execute(parsed.data);
      return create(AdminServiceGetMarketsResponseSchema, {
        markets: result.markets.map((market) =>
          create(CryptoMarketSchema, market),
        ),
        vsCurrency: result.vsCurrency,
      });
    } catch (error) {
      if (error instanceof CoinInformationUnavailableError) {
        throw new ConnectError(
          COIN_INFORMATION_RPC_ERROR_MESSAGES.unavailable,
          Code.Unavailable,
        );
      }
      throw new ConnectError(
        COIN_INFORMATION_RPC_ERROR_MESSAGES.internal,
        Code.Internal,
      );
    }
  };

export const createAdminServiceRoutes =
  (getMarkets: GetMarkets) =>
  (router: ConnectRouter): void => {
    router.service(AdminService, {
      getMarkets: createGetMarketsHandler(getMarkets),
    });
  };
