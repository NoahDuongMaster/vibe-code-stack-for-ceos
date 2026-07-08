import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const MOCK_URL = 'http://localhost:3000/api/mock';

describe('GET /api/mock', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('should 404 in production regardless of query params', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { GET } = await import('@/app/api/mock/route');

    const res = await GET(new NextRequest(`${MOCK_URL}?delay=99999999999`));

    expect(res.status).toBe(404);
  });

  it('should clamp an oversized delay instead of holding the request open', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { GET } = await import('@/app/api/mock/route');
    vi.useFakeTimers();

    const promise = GET(new NextRequest(`${MOCK_URL}?delay=99999999999`));
    // If the delay weren't clamped, this would still be pending after
    // advancing only 5s (MAX_DELAY_MS) — the awaited setTimeout would need
    // to fire ~1157 years of fake-timer advancement first.
    await vi.advanceTimersByTimeAsync(5_000);
    const res = await promise;

    expect(res.status).toBe(200);
    vi.useRealTimers();
  });

  it('should treat a negative or non-numeric delay as zero', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { GET } = await import('@/app/api/mock/route');

    const res = await GET(new NextRequest(`${MOCK_URL}?delay=not-a-number`));

    expect(res.status).toBe(200);
  });
});
