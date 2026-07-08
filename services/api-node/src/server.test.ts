import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from './server';

const ECHO_PATH = '/api.v1.ApiService/Echo';

describe('createServer', () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  async function start(options?: Parameters<typeof createServer>[0]) {
    server = createServer(options);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  }

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('/healthz', () => {
    beforeEach(() => start());

    it('should return 200 ok fast, without touching the RPC handler', async () => {
      const res = await fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok' });
    });
  });

  describe('Connect RPC', () => {
    beforeEach(() => start());

    it('should serve a valid Echo request', async () => {
      const res = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'node' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { upper: string; runtime: string };
      expect(body.upper).toBe('NODE');
      expect(body.runtime).toBe('node');
    });

    it('should reject a request whose Content-Length exceeds maxBodyBytes with 413', async () => {
      await server.close();
      await start({ maxBodyBytes: 10 });

      const res = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'this body is longer than ten bytes' }),
      });

      expect(res.status).toBe(413);
    });

    it('should still enforce the size cap for a chunked request with no Content-Length', async () => {
      await server.close();
      await start({ maxBodyBytes: 10 });

      const oversized = JSON.stringify({
        message: 'this body is longer than ten bytes',
      });
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(oversized));
          controller.close();
        },
      });

      const res = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: stream,
        duplex: 'half',
      });

      // No Content-Length header reaches the server (fetch sends chunked
      // transfer-encoding for stream bodies), so the fast-path check in
      // server.ts never fires — this only fails closed because
      // `readMaxBytes` is enforced by the Connect handler itself.
      expect(res.status).not.toBe(200);
    });
  });

  describe('rate limiting', () => {
    it('should 429 once a client exceeds the configured limit', async () => {
      await start({ rateLimit: 2, rateLimitWindowMs: 60_000 });

      const ok1 = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'a' }),
      });
      const ok2 = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'b' }),
      });
      const limited = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'c' }),
      });

      expect(ok1.status).toBe(200);
      expect(ok2.status).toBe(200);
      expect(limited.status).toBe(429);
    });

    it('should never rate-limit /healthz', async () => {
      await start({ rateLimit: 1, rateLimitWindowMs: 60_000 });

      await fetch(`${baseUrl}/healthz`);
      const res = await fetch(`${baseUrl}/healthz`);

      expect(res.status).toBe(200);
    });
  });

  describe('CORS', () => {
    it('should answer an allowed-origin preflight with 204 and CORS headers', async () => {
      await start({ corsOrigins: ['https://admin.example.com'] });

      const res = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'OPTIONS',
        headers: { origin: 'https://admin.example.com' },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://admin.example.com',
      );
    });

    it('should not set CORS headers for a disallowed origin', async () => {
      await start({ corsOrigins: ['https://admin.example.com'] });

      const res = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example.com' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('should default to no allowed origins when none are configured', async () => {
      await start();

      const res = await fetch(`${baseUrl}${ECHO_PATH}`, {
        method: 'OPTIONS',
        headers: { origin: 'https://anything.example.com' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});
