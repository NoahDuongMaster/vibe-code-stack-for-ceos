// Public barrel — the ONLY surface importable from outside `features/users`.
export { UserForm } from './_components/user-form';
export { UsersTable } from './_components/users-table';
export { useCreateUser, useUsers } from './_hooks/use-users';
export {
  type TCreateUserInput,
  type TUser,
  USER_ROLES,
  ZCreateUserInput,
  ZUser,
} from './schemas/user.schema';
export { userService } from './services/user.service';
