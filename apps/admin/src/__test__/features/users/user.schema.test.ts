import { describe, expect, it } from 'vitest';
import { ZCreateUserInput } from '@/features/users/schemas/user.schema';

describe('ZCreateUserInput', () => {
  it('should accept a valid payload', () => {
    const result = ZCreateUserInput.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'admin',
    });

    expect(result.success).toBe(true);
  });

  it('should reject a name shorter than 2 characters', () => {
    const result = ZCreateUserInput.safeParse({
      name: 'A',
      email: 'a@example.com',
      role: 'member',
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid email', () => {
    const result = ZCreateUserInput.safeParse({
      name: 'Ada',
      email: 'not-an-email',
      role: 'member',
    });

    expect(result.success).toBe(false);
  });

  it('should reject an unknown role', () => {
    const result = ZCreateUserInput.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      role: 'superuser',
    });

    expect(result.success).toBe(false);
  });
});
