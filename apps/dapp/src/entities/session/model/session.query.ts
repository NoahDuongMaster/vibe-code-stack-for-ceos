'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSession } from '@/entities/session/api/session.api';
import { SESSION_QUERY_KEY } from '@/entities/session/model/session.constants';
import type { TSessionData } from '@/entities/session/model/session.schema';

export const useSession = (initialData?: TSessionData) =>
  useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 60_000,
    initialData,
  });
