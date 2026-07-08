import { createUserAPI, getUsersAPI } from '../adapters/user.adapter';
import type { TCreateUserInput } from '../schemas/user.schema';

export const userService = {
  list: () => getUsersAPI(),
  create: (input: TCreateUserInput) => createUserAPI(input),
};
