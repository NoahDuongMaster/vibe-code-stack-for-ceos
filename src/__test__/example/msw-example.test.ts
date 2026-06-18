/**
 * MSW Example Tests
 *
 * These tests demonstrate two MSW patterns:
 *
 * 1. Default handlers (defined in src/__test__/mocks/handlers.ts) are active
 *    for every test automatically via the setup in src/__test__/setup/server.ts.
 *    No per-test setup needed.
 *
 * 2. Per-test handler overrides via server.use():
 *    Call server.use(http.get(...)) inside a test to override a handler for
 *    that test only. The setup file calls server.resetHandlers() in afterEach,
 *    so overrides are automatically removed after each test — no cleanup needed.
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../mocks/server';

describe('MSW default handlers', () => {
  it('GET /api/health returns ok status', async () => {
    const response = await fetch('/api/health');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(typeof data.timestamp).toBe('string');
  });

  it('POST /api/auth/login returns success for valid credentials', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('POST /api/auth/login returns 401 for invalid credentials', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad@example.com', password: 'wrong' }),
    });

    expect(response.status).toBe(401);
  });
});

describe('MSW per-test handler overrides', () => {
  it('server.use() overrides the default handler for this test only', async () => {
    // Override the /api/health handler to simulate a service outage (503).
    // After this test, server.resetHandlers() (called in afterEach) restores
    // the original handler automatically.
    server.use(
      http.get('/api/health', () => {
        return HttpResponse.json(
          { status: 'error', message: 'Service unavailable' },
          { status: 503 },
        );
      }),
    );

    const response = await fetch('/api/health');
    expect(response.status).toBe(503);
  });

  it('default /api/health handler is restored after override test', async () => {
    // Confirms resetHandlers() cleaned up the 503 override above
    const response = await fetch('/api/health');
    expect(response.status).toBe(200);
  });
});
