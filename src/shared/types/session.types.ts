export type TSessionUser = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  accessToken: string;
};

export type TSessionData = {
  user?: TSessionUser;
  isLoggedIn: boolean;
};
