import { apiClient } from '@/shared/lib/api-client';
import type { THealthResponse } from '../schemas/health.schema';

export const getHealthAPI = (): Promise<THealthResponse> =>
  apiClient.health({});
