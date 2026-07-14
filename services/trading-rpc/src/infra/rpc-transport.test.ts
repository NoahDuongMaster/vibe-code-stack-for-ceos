import { describe, expect, it } from 'vitest';
import { resolveRpcTransport } from '@/infra/rpc-transport';

describe('resolveRpcTransport', () => {
  it('should select HTTP/1.1 for development when no override is set', () => {
    expect(resolveRpcTransport(undefined, 'development')).toBe('http1');
  });

  it('should select HTTP/2 outside development when no override is set', () => {
    expect(resolveRpcTransport(undefined, 'production')).toBe('http2');
  });

  it('should reject an unsupported transport override', () => {
    expect(() => resolveRpcTransport('h3', 'development')).toThrow(
      'Invalid RPC_TRANSPORT',
    );
  });
});
