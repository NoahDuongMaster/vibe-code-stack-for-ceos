import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { router } from '@/app/router';
import { useSessionStore } from '@/entities/session';
import { onUnauthenticated } from '@/shared/api';
import { ROUTES } from '@/shared/routes';

/** Keeps transport-level unauthenticated events coordinated at the App layer. */
export function SessionEvents() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onUnauthenticated(() => {
        useSessionStore.getState().signOut();
        queryClient.clear();
        void router.navigate(ROUTES.LOGIN);
      }),
    [queryClient],
  );

  return null;
}
