import { beforeEach, describe, expect, it, vi } from 'vitest';

const health = vi.fn();

vi.mock('@/shared/api', () => ({
  apiClient: { health },
}));

describe('getHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate to the Connect RPC client health() call', async () => {
    const response = { status: 'ok', service: 'trading-rpc', runtime: 'node' };
    health.mockResolvedValue(response);

    const { getHealth } = await import('@/pages/dashboard/api/health.api');

    await expect(getHealth()).resolves.toEqual(response);
    expect(health).toHaveBeenCalledWith({});
  });
});
