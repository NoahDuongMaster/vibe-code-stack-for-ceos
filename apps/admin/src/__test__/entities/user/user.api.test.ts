import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, getUsers } from '@/entities/user/api/user.api';
import type { TUserDraft } from '@/entities/user/model/user.schema';

describe('user API', () => {
  describe('getUsers', () => {
    it('should resolve with the seeded users', async () => {
      const users = await getUsers();

      expect(users.length).toBeGreaterThan(0);
      expect(users[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        email: expect.any(String),
        role: expect.stringMatching(/admin|member|viewer/),
      });
    });

    it('should return a fresh array each call (not a live reference)', async () => {
      const first = await getUsers();
      first.pop();

      const second = await getUsers();

      expect(second.length).not.toBe(first.length);
    });
  });

  describe('createUser', () => {
    beforeEach(async () => {
      // Reset by reading current state — the API holds module-level mutable
      // state, so tests only assert relative growth, not absolute counts.
      await getUsers();
    });

    it('should create a user and prepend it to the list', async () => {
      const before = await getUsers();
      const input: TUserDraft = {
        name: 'Test User',
        email: 'test.user@example.com',
        role: 'viewer',
      };

      const created = await createUser(input);

      expect(created).toMatchObject(input);
      expect(created.id).toEqual(expect.any(String));
      expect(created.createdAt).toEqual(expect.any(String));

      const after = await getUsers();
      expect(after.length).toBe(before.length + 1);
      expect(after[0]).toEqual(created);
    });
  });
});
