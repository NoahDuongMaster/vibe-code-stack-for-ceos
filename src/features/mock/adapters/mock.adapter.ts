import { Request } from '@/shared/lib/xhr';
import { API_ROUTES } from '@/shared/constants/routes.constant';

import type { TGetMockQuery, TGetMockResponse } from '../schemas/mock.schema';

const request = new Request();

export const getMockAPI = async ({ delay, error }: TGetMockQuery) =>
  request.get<TGetMockResponse>(API_ROUTES.GET_MOCK, {
    delay,
    error,
  });
