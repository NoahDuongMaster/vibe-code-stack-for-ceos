import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './index';

const ECHO_URL = 'http://localhost:3001/api.v1.ApiService/Echo';
const HEALTH_URL = 'http://localhost:3001/api.v1.ApiService/Health';

describe('createApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should build a client exposing every ApiService method', () => {
    const client = createApiClient('http://localhost:3001');

    expect(client.echo).toBeTypeOf('function');
    expect(client.health).toBeTypeOf('function');
  });

  it('should POST echo requests to the configured baseUrl and return the typed response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(ECHO_URL);
      return new Response(
        JSON.stringify({
          message: 'hi',
          upper: 'HI',
          length: 2,
          runtime: 'test',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient('http://localhost:3001');
    const res = await client.echo({ message: 'hi' });

    expect(res).toMatchObject({ upper: 'HI', length: 2, runtime: 'test' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should POST health requests and return the typed response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(HEALTH_URL);
      return new Response(
        JSON.stringify({ status: 'ok', service: 'api-node', runtime: 'node' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient('http://localhost:3001');
    const res = await client.health({});

    expect(res).toMatchObject({
      status: 'ok',
      service: 'api-node',
      runtime: 'node',
    });
  });

  it('should reject when the server returns a Connect error response', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'internal', message: 'boom' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient('http://localhost:3001');

    await expect(client.echo({ message: 'hi' })).rejects.toThrow();
  });

  it('should forward extra transport options (e.g. custom headers via interceptors)', async () => {
    let seenHeaders: Headers | undefined;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = new Headers(init?.headers);
        return new Response(
          JSON.stringify({
            message: 'hi',
            upper: 'HI',
            length: 2,
            runtime: 'test',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createApiClient('http://localhost:3001', {
      interceptors: [
        (next) => (req) => {
          req.header.set('x-custom', 'yes');
          return next(req);
        },
      ],
    });
    await client.echo({ message: 'hi' });

    expect(seenHeaders?.get('x-custom')).toBe('yes');
  });
});
