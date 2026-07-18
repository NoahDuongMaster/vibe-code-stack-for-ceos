import { type Client, createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { TradingService } from '@packages/protocol';
import { z } from 'zod';
import { CoinInformationUnavailableError } from '@/features/coin-information/domain/errors';
import type {
  TradingMarketData,
  TTradingMarketsInput,
  TTradingMarketsResult,
} from '@/features/coin-information/domain/trading-market-data.port';

const ZCoinMarket = z.object({
  id: z.string().trim().min(1),
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1),
  imageUrl: z.url().optional(),
  currentPrice: z.number().finite().optional(),
  marketCap: z.number().finite().optional(),
  marketCapRank: z.number().int().positive().optional(),
  priceChange24h: z.number().finite().optional(),
  priceChangePercentage24h: z.number().finite().optional(),
  totalVolume: z.number().finite().nonnegative().optional(),
  lastUpdated: z.iso.datetime({ offset: true }).optional(),
});

const ZTradingMarketsResponse = z.object({
  markets: z.array(ZCoinMarket),
  vsCurrency: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{3,10}$/),
});

export interface TTradingRpcMarketDataOptions {
  baseUrl: string;
  timeoutMs: number;
}

type TTradingClient = Pick<Client<typeof TradingService>, 'getMarkets'>;

/** Native-gRPC driven adapter for the trading-rpc market-data contract. */
export const createTradingRpcMarketData = (
  options: TTradingRpcMarketDataOptions,
  client: TTradingClient = createClient(
    TradingService,
    createGrpcTransport({ baseUrl: options.baseUrl }),
  ),
): TradingMarketData => ({
  async getMarkets(
    input: TTradingMarketsInput,
  ): Promise<TTradingMarketsResult> {
    try {
      const response = await client.getMarkets(
        {
          coinIds: input.coinIds,
          vsCurrency: input.vsCurrency,
        },
        { timeoutMs: options.timeoutMs },
      );
      const parsed = ZTradingMarketsResponse.safeParse(response);
      if (!parsed.success || parsed.data.vsCurrency !== input.vsCurrency) {
        throw new CoinInformationUnavailableError({
          cause: parsed.success
            ? new Error('Trading RPC returned an unexpected quote currency')
            : parsed.error,
        });
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof CoinInformationUnavailableError) throw error;
      throw new CoinInformationUnavailableError({ cause: error });
    }
  },
});
