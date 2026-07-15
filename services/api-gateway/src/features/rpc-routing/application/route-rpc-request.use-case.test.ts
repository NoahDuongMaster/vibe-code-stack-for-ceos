import { describe, expect, it, vi } from 'vitest';
import { RouteRpcRequestUseCase } from '@/features/rpc-routing/application/route-rpc-request.use-case';

describe('[RouteRpcRequestUseCase]', () => {
  const command = {
    request: 'opaque-request',
    requestId: 'request-1',
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
});
