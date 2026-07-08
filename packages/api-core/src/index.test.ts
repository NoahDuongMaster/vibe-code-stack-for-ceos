import { createClient, createRouterTransport } from '@connectrpc/connect';
import { ApiService } from '@repo/protocol';
import { describe, expect, it } from 'vitest';
import { createFetchHandler, createRoutes } from './index';

const config = { serviceName: 'test-service', runtime: 'test-runtime' };

describe('createRoutes', () => {
  // In-memory transport — exercises the real handler logic with zero network.
  const client = createClient(
    ApiService,
    createRouterTransport(createRoutes(config)),
  );

  describe('echo', () => {
    it('should return the message with its uppercase, length, and runtime', async () => {
      const res = await client.echo({ message: 'hello' });

      expect(res).toMatchObject({
        message: 'hello',
        upper: 'HELLO',
        length: 5,
        runtime: 'test-runtime',
      });
    });

    it('should handle an empty message (length 0)', async () => {
      const res = await client.echo({ message: '' });

      expect(res.upper).toBe('');
      expect(res.length).toBe(0);
    });
  });

  describe('health', () => {
    it('should report "ok" with the configured service and runtime', async () => {
      const res = await client.health({});

      expect(res).toMatchObject({
        status: 'ok',
        service: 'test-service',
        runtime: 'test-runtime',
      });
    });
  });
});

describe('createFetchHandler', () => {
  const handler = createFetchHandler({
    serviceName: 'edge',
    runtime: 'edge-runtime',
  });
  const ECHO_PATH = 'http://localhost/api.v1.ApiService/Echo';

  it('should return 404 for an unknown path', async () => {
    const res = await handler(new Request('http://localhost/does-not-exist'));

    expect(res.status).toBe(404);
  });

  it('should return 404 when the HTTP method is not allowed', async () => {
    const res = await handler(new Request(ECHO_PATH, { method: 'GET' }));

    expect(res.status).toBe(404);
  });

  it('should serve a valid Connect echo request over fetch', async () => {
    const res = await handler(
      new Request(ECHO_PATH, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
        },
        body: JSON.stringify({ message: 'edge' }),
      }),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as { upper: string; runtime: string };
    expect(body.upper).toBe('EDGE');
    expect(body.runtime).toBe('edge-runtime');
  });
});

describe('createFetchHandler CORS', () => {
  const corsConfig = {
    serviceName: 'edge',
    runtime: 'edge-runtime',
    corsOrigins: ['https://admin.example.com'],
  };
  const ECHO_PATH = 'http://localhost/api.v1.ApiService/Echo';

  it('should answer an allowed-origin preflight with 204 and CORS headers', async () => {
    const handler = createFetchHandler(corsConfig);
    const res = await handler(
      new Request(ECHO_PATH, {
        method: 'OPTIONS',
        headers: { origin: 'https://admin.example.com' },
      }),
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://admin.example.com',
    );
  });

  it('should not set CORS headers for a disallowed origin', async () => {
    const handler = createFetchHandler(corsConfig);
    const res = await handler(
      new Request(ECHO_PATH, {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example.com' },
      }),
    );

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('should annotate a real response with CORS headers for an allowed origin', async () => {
    const handler = createFetchHandler(corsConfig);
    const res = await handler(
      new Request(ECHO_PATH, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'connect-protocol-version': '1',
          origin: 'https://admin.example.com',
        },
        body: JSON.stringify({ message: 'edge' }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://admin.example.com',
    );
  });

  it('should support a wildcard "*" allow-list', async () => {
    const handler = createFetchHandler({
      serviceName: 'edge',
      runtime: 'edge-runtime',
      corsOrigins: ['*'],
    });
    const res = await handler(
      new Request(ECHO_PATH, {
        method: 'OPTIONS',
        headers: { origin: 'https://anything.example.com' },
      }),
    );

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('should let a runtime override corsOrigins per-request (e.g. from a Workers env binding)', async () => {
    const handler = createFetchHandler({
      serviceName: 'edge',
      runtime: 'edge-runtime',
    });
    const res = await handler(
      new Request(ECHO_PATH, {
        method: 'OPTIONS',
        headers: { origin: 'https://runtime.example.com' },
      }),
      ['https://runtime.example.com'],
    );

    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://runtime.example.com',
    );
  });
});
