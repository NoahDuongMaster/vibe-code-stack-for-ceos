import { xhr } from '@/shared/api';
import { API_ROUTES } from '@/shared/routes';
import type { TSessionData } from '../model/session.schema';

export const fetchSession = async (): Promise<TSessionData> => {
  try {
    return await xhr<TSessionData>(API_ROUTES.AUTH_ME);
  } catch {
    return { isLoggedIn: false };
  }
};
