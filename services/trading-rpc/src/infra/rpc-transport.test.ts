import { describe, expect, it } from 'vitest';
import { resolveRpcTransport } from '@/infra/rpc-transport';

describe('resolveRpcTransport', () => {
  it('should select HTTP/1.1 for development when no override is set', () => {
    expect(resolveRpcTransport(undefined)).toBe('http1');
  });

  it('should keep the Connect listener on HTTP/1.1 in production', () => {
    expect(resolveRpcTransport(undefined)).toBe('http1');
  });

  it('should reject an unsupported transport override', () => {
    expect(() => resolveRpcTransport('h3')).toThrow('Invalid RPC_TRANSPORT');
  });
});
