import type { TUser, TUserDraft } from '../model/user.schema';

/**
 * ── In-memory data source (the integration seam) ─────────────────────────────
 * The proto (@packages/protocol) does not expose a UserService yet, so this API
 * module simulates a Users backend. When UserService is added to the proto,
 * swap these two functions for Connect RPC calls via `@packages/api-client` — the
 * model and UI consumers stay untouched. That is the point of isolating I/O in
 * the slice's API segment.
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

export const getUsers = async (): Promise<TUser[]> => {
  await delay(300);
  return [...users];
};

export const createUser = async (input: TUserDraft): Promise<TUser> => {
  await delay(300);
  const user: TUser = {
    id: `u_${users.length + 1}_${input.email.split('@')[0]}`,
    createdAt: new Date().toISOString().slice(0, 10),
    ...input,
  };
  users = [user, ...users];
  return user;
};
