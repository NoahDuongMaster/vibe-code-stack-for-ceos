import type { TCreateUserInput, TUser } from '../schemas/user.schema';

/**
 * ── In-memory data source (the integration seam) ─────────────────────────────
 * The proto (@repo/protocol) currently exposes only Echo + Health, so this
 * adapter simulates a Users backend. When a UserService is added to the proto,
 * swap these two functions for Connect RPC calls via `@repo/api-client` — the
 * service / hooks / components above stay untouched. That is the whole point of
 * isolating I/O in the adapter layer.
 */
let users: TUser[] = [
  {
    id: 'u_1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'admin',
    createdAt: '2024-01-04',
  },
  {
    id: 'u_2',
    name: 'Alan Turing',
    email: 'alan@example.com',
    role: 'admin',
    createdAt: '2024-02-11',
  },
  {
    id: 'u_3',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    role: 'member',
    createdAt: '2024-03-19',
  },
  {
    id: 'u_4',
    name: 'Katherine Johnson',
    email: 'katherine@example.com',
    role: 'member',
    createdAt: '2024-05-02',
  },
  {
    id: 'u_5',
    name: 'Linus Torvalds',
    email: 'linus@example.com',
    role: 'viewer',
    createdAt: '2024-06-23',
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getUsersAPI = async (): Promise<TUser[]> => {
  await delay(300);
  return [...users];
};

export const createUserAPI = async (
  input: TCreateUserInput,
): Promise<TUser> => {
  await delay(300);
  const user: TUser = {
    id: `u_${users.length + 1}_${input.email.split('@')[0]}`,
    createdAt: new Date().toISOString().slice(0, 10),
    ...input,
  };
  users = [user, ...users];
  return user;
};
