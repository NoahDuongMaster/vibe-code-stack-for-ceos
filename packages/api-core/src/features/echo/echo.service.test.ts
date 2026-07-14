import { describe, expect, it } from 'vitest';
import { echoService } from './echo.service';

describe('echoService', () => {
  it('should return the message with its uppercase and length', () => {
    expect(echoService.echo({ message: 'hello' })).toEqual({
      message: 'hello',
      upper: 'HELLO',
      length: 5,
    });
  });

  it('should handle an empty message', () => {
    expect(echoService.echo({ message: '' })).toEqual({
      message: '',
      upper: '',
      length: 0,
    });
  });
});
