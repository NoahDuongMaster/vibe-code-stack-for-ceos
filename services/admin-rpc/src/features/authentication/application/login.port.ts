import type { TAdminIdentity } from '@/features/authentication/domain/authentication.port';

export interface TLoginInput {
  email: string;
  password: string;
}

export interface TLoginResult {
  token: string;
  user: TAdminIdentity;
}

export interface Login {
  execute(input: TLoginInput): Promise<TLoginResult>;
}
