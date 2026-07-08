'use client';

import { Toaster as ArkToaster, Toast } from '@ark-ui/react/toast';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react';
import { toaster } from '@/shared/lib/toaster';
import { css } from '@/styled-system/css';

const iconMap = {
  success: CircleCheckIcon,
  error: CircleAlertIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
};

export function AppToaster() {
  return (
    <ArkToaster toaster={toaster}>
      {(toast) => {
        const ToastIcon = toast.type
          ? iconMap[toast.type as keyof typeof iconMap]
          : undefined;
        return (
          <Toast.Root
            className={css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '3',
              rounded: 'lg',
              borderWidth: '1px',
              bg: 'background',
              p: '4',
              shadow: 'lg',
              '&[data-type=error]': { borderColor: 'destructive' },
              '&[data-type=success]': { borderColor: 'green.500' },
            })}
          >
            {ToastIcon && (
              <ToastIcon
                className={css({ mt: '0.5', h: '5', w: '5', flexShrink: 0 })}
              />
            )}
            <div
              className={css({
                flex: '1',
                display: 'flex',
                flexDir: 'column',
                gap: '1',
              })}
            >
              <Toast.Title
                className={css({ fontSize: 'sm', fontWeight: 'semibold' })}
              >
                {toast.title}
              </Toast.Title>
              {toast.description && (
                <Toast.Description
                  className={css({ fontSize: 'sm', color: 'muted.foreground' })}
                >
                  {toast.description}
                </Toast.Description>
              )}
            </div>
            <Toast.CloseTrigger
              className={css({
                rounded: 'sm',
                opacity: 0.7,
                cursor: 'pointer',
                transition: 'opacity',
                _hover: { opacity: 1 },
              })}
            >
              <XIcon className={css({ h: '4', w: '4' })} />
            </Toast.CloseTrigger>
          </Toast.Root>
        );
      }}
    </ArkToaster>
  );
}
