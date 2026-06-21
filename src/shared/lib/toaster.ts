'use client';

import { createToaster } from '@ark-ui/react/toast';

export const toaster = createToaster({
  placement: 'top-end',
  overlap: true,
  gap: 16,
});
