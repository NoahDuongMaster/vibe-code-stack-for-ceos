import { describe, expect, it } from 'vitest';
import { ZLoginInput } from '@/features/auth';

describe('ZLoginInput', () => {
  it('should accept valid credentials', () => {
    const result = ZLoginInput.safeParse({
      email: 'admin@example.com',
      password: 'password',
    });

    expect(result.success).toBe(true);
  });

  it('should reject a password shorter than 6 characters', () => {
    const result = ZLoginInput.safeParse({
      email: 'admin@example.com',
      password: '123',
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid email', () => {
    const result = ZLoginInput.safeParse({
      email: 'not-an-email',
      password: 'password',
    });

    expect(result.success).toBe(false);
  });
});
