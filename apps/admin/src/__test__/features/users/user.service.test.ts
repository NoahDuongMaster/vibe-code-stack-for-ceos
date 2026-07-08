import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createUserAPI,
  getUsersAPI,
} from '@/features/users/adapters/user.adapter';
import type {
  TCreateUserInput,
  TUser,
} from '@/features/users/schemas/user.schema';
import { userService } from '@/features/users/services/user.service';

// Mock the adapter (HTTP/data layer) — never the service under test.
vi.mock('@/features/users/adapters/user.adapter', () => ({
  getUsersAPI: vi.fn(),
  createUserAPI: vi.fn(),
}));

describe('userService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return the list of users from the adapter', async () => {
    const users: TUser[] = [
      {
        id: 'u_1',
        name: 'Ada',
        email: 'ada@example.com',
        role: 'admin',
        createdAt: '2024-01-01',
      },
    ];
    vi.mocked(getUsersAPI).mockResolvedValue(users);

    await expect(userService.list()).resolves.toEqual(users);
    expect(getUsersAPI).toHaveBeenCalledOnce();
  });

  it('should delegate creation to the adapter with the given input', async () => {
    const input: TCreateUserInput = {
      name: 'Neo',
      email: 'neo@example.com',
      role: 'member',
    };
    const created: TUser = { id: 'u_2', createdAt: '2024-01-02', ...input };
    vi.mocked(createUserAPI).mockResolvedValue(created);

    await expect(userService.create(input)).resolves.toEqual(created);
    expect(createUserAPI).toHaveBeenCalledWith(input);
  });
});
