'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSession } from '../api/session.api';
import { SESSION_QUERY_KEY } from './session.constants';
import type { TSessionData } from './session.schema';

export const useSession = (initialData?: TSessionData) =>
  useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 60_000,
    initialData,
  });
