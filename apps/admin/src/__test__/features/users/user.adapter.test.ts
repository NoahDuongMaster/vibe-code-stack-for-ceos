import { beforeEach, describe, expect, it } from 'vitest';
import {
  createUserAPI,
  getUsersAPI,
} from '@/features/users/adapters/user.adapter';
import type { TCreateUserInput } from '@/features/users/schemas/user.schema';

describe('user.adapter', () => {
  describe('getUsersAPI', () => {
    it('should resolve with the seeded users', async () => {
      const users = await getUsersAPI();

      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.stringMatching(/admin|member|viewer/),
      });
    });

    it('should return a fresh array each call (not a live reference)', async () => {
      const first = await getUsersAPI();
      first.pop();

      const second = await getUsersAPI();

      expect(second.length).not.toBe(first.length);
    });
  });

  describe('createUserAPI', () => {
    beforeEach(async () => {
      // Reset by reading current state — adapter holds module-level mutable
      // state, so tests only assert relative growth, not absolute counts.
      await getUsersAPI();
    });

    it('should create a user and prepend it to the list', async () => {
      const before = await getUsersAPI();
      const input: TCreateUserInput = {
        name: 'Test User',
        email: 'test.user@example.com',
        role: 'viewer',
      };

      const created = await createUserAPI(input);

      expect(created).toMatchObject(input);
      expect(created.id).toEqual(expect.any(String));
      expect(created.createdAt).toEqual(expect.any(String));

      const after = await getUsersAPI();
      expect(after.length).toBe(before.length + 1);
      expect(after[0]).toEqual(created);
    });
  });
});
