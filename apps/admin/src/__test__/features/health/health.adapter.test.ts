import { beforeEach, describe, expect, it, vi } from 'vitest';

const health = vi.fn();

// health.adapter builds its Connect RPC client at module load time via
// createApiClient — mock the transport factory so we can assert the call
// without hitting a real network.
vi.mock('@repo/api-client', () => ({
  createApiClient: vi.fn(() => ({ health })),
}));

describe('health.adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate to the Connect RPC client health() call', async () => {
    const response = { status: 'ok', service: 'api-node', runtime: 'node' };
    health.mockResolvedValue(response);

    const { getHealthAPI } = await import(
      '@/features/health/adapters/health.adapter'
    );

    await expect(getHealthAPI()).resolves.toEqual(response);
    expect(health).toHaveBeenCalledWith({});
  });
});
