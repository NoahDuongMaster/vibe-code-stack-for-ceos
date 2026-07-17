import type { TSessionData } from '@/entities/session/model/session.schema';
import { xhr } from '@/shared/api';
import { API_ROUTES } from '@/shared/routes';

export const fetchSession = async (): Promise<TSessionData> => {
  try {
    return await xhr<TSessionData>(API_ROUTES.AUTH_ME);
  } catch {
    return { isLoggedIn: false };
  }
};
