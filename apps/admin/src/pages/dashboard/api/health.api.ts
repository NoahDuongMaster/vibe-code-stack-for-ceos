import type { HealthResponse as THealthResponse } from '@packages/api-client';
import { apiClient } from '@/shared/api';

export const getHealth = (): Promise<THealthResponse> => apiClient.health({});

export type { THealthResponse };
