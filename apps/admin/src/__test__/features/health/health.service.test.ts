import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHealthAPI } from '@/features/health/adapters/health.adapter';
import type { THealthResponse } from '@/features/health/schemas/health.schema';
import { healthService } from '@/features/health/services/health.service';

// Mock the adapter (HTTP layer) — never the service under test.
vi.mock('@/features/health/adapters/health.adapter', () => ({
  getHealthAPI: vi.fn(),
}));

// Minimal fixture matching the public field shape of the generated
// HealthResponse protobuf message — the `$typeName` runtime brand isn't
// relevant to this behavioral test, so it's cast rather than constructed via
// the protobuf runtime.
const healthResponse = {
  status: 'ok',
  service: 'api-node',
  runtime: 'node',
} as unknown as THealthResponse;

describe('healthService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should delegate check() to the adapter', async () => {
    const response = healthResponse;
    vi.mocked(getHealthAPI).mockResolvedValue(response);

    await expect(healthService.check()).resolves.toEqual(response);
    expect(getHealthAPI).toHaveBeenCalledOnce();
  });

  it('should propagate adapter failures', async () => {
    const error = new Error('network down');
    vi.mocked(getHealthAPI).mockRejectedValue(error);

    await expect(healthService.check()).rejects.toThrow('network down');
  });
});
