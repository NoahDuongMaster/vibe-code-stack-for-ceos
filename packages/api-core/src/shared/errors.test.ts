import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { DomainError, toConnectError } from './errors';

describe('toConnectError', () => {
  it('should pass a ConnectError through unchanged', () => {
    const original = new ConnectError('nope', Code.NotFound);
    expect(toConnectError(original)).toBe(original);
  });

  it('should map a DomainError onto its code and message', () => {
    const result = toConnectError(
      new DomainError('bad input', Code.InvalidArgument),
    );
    expect(result.code).toBe(Code.InvalidArgument);
    expect(result.message).toContain('bad input');
  });

  it('should hide an unexpected error behind a generic internal error', () => {
    const result = toConnectError(new Error('secret stack detail'));
    expect(result.code).toBe(Code.Internal);
    expect(result.message).not.toContain('secret');
  });
});
