import { describe, expect, it, vi } from 'vitest';
import { RouteRpcRequestUseCase } from '@/features/rpc-routing/application/route-rpc-request.use-case';

describe('[RouteRpcRequestUseCase]', () => {
  const command = {
    request: 'opaque-request',
    requestId: 'request-1',
    rpcPath: '/trading.v1.TradingService/GetMarkets',
  };

  it('should return an edge-owned response without calling trading RPC', async () => {
    const tradingHandle = vi.fn(async () => ({
      handled: true,
      response: 'trading',
    }));
    const useCase = new RouteRpcRequestUseCase(
      { handle: vi.fn(async () => ({ handled: true, response: 'edge' })) },
      { handle: tradingHandle },
    );

    const response = await useCase.execute(command);

    expect(response).toBe('edge');
    expect(tradingHandle).not.toHaveBeenCalled();
  });

  it('should delegate an edge miss to trading RPC', async () => {
    const tradingHandle = vi.fn(async () => ({
      handled: true,
      response: 'trading',
    }));
    const useCase = new RouteRpcRequestUseCase(
      { handle: vi.fn(async () => ({ handled: false, response: 'missing' })) },
      { handle: tradingHandle },
    );

    const response = await useCase.execute(command);

    expect(response).toBe('trading');
    expect(tradingHandle).toHaveBeenCalledWith(command);
  });

  it('should route AdminService calls to admin RPC', async () => {
    const tradingHandle = vi.fn(async () => ({
      handled: true,
      response: 'trading',
    }));
    const adminHandle = vi.fn(async () => ({
      handled: true,
      response: 'admin',
    }));
    const useCase = new RouteRpcRequestUseCase(
      { handle: vi.fn(async () => ({ handled: false, response: 'missing' })) },
      { handle: tradingHandle },
      { handle: adminHandle },
    );
    const adminCommand = {
      ...command,
      rpcPath: '/admin.v1.AdminService/GetMarkets',
    };

    const response = await useCase.execute(adminCommand);

    expect(response).toBe('admin');
    expect(adminHandle).toHaveBeenCalledWith(adminCommand);
    expect(tradingHandle).not.toHaveBeenCalled();
  });

  it('should fail safely when AdminService is called without an admin endpoint', async () => {
    const useCase = new RouteRpcRequestUseCase(
      { handle: vi.fn(async () => ({ handled: false, response: 'missing' })) },
      { handle: vi.fn(async () => ({ handled: true, response: 'trading' })) },
    );

    await expect(
      useCase.execute({
        ...command,
        rpcPath: '/admin.v1.AdminService/GetMarkets',
      }),
    ).rejects.toThrow('Upstream RPC service is unavailable');
  });
});
