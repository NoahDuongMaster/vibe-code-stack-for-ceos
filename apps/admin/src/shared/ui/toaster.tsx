import {
  createToaster,
  ToastCloseTrigger,
  ToastDescription,
  Toaster,
  ToastRoot,
  ToastTitle,
} from '@ark-ui/react/toast';
import { css } from '@/styled-system/css';

export const toaster = createToaster({ placement: 'bottom-end', gap: 12 });

/** Convenience wrappers so callers don't repeat the `type` field. */
export const toast = {
  success: (title: string, description?: string) =>
    toaster.create({ title, description, type: 'success' }),
  error: (title: string, description?: string) =>
    toaster.create({ title, description, type: 'error' }),
  info: (title: string, description?: string) =>
    toaster.create({ title, description, type: 'info' }),
};

export function AppToaster() {
  return (
    <Toaster toaster={toaster}>
      {(item) => (
        <ToastRoot
          key={item.id}
          className={css({
            display: 'flex',
            gap: '3',
            alignItems: 'start',
            justifyContent: 'space-between',
            minW: '64',
            p: '4',
            rounded: 'lg',
            borderWidth: '1px',
            borderColor: 'border',
            bg: 'card',
            color: 'foreground',
            boxShadow: 'lg',
          })}
        >
          <div>
            <ToastTitle
              className={css({ fontWeight: 'semibold', fontSize: 'sm' })}
            >
              {item.title}
            </ToastTitle>
            {item.description ? (
              <ToastDescription
                className={css({
                  mt: '0.5',
                  fontSize: 'sm',
                  color: 'muted.foreground',
                })}
              >
                {item.description}
              </ToastDescription>
            ) : null}
          </div>
          <ToastCloseTrigger
            className={css({
              color: 'muted.foreground',
              cursor: 'pointer',
              fontSize: 'sm',
              lineHeight: '1',
            })}
            aria-label="Dismiss"
          >
            ✕
          </ToastCloseTrigger>
        </ToastRoot>
      )}
    </Toaster>
  );
}
