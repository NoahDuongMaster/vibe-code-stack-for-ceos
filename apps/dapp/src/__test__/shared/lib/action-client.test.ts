import { describe, expect, it } from 'vitest';
import { ActionError, actionClient } from '@/shared/lib/action-client';

describe('actionClient', () => {
  it('should surface an ActionError message verbatim', async () => {
    const action = actionClient.action(async () => {
      throw new ActionError('Session already expired');
    });

    const result = await action();

    expect(result?.serverError).toBe('Session already expired');
  });

  it('should mask any other thrown error behind a generic message', async () => {
    const action = actionClient.action(async () => {
      throw new Error(
        'duplicate key value violates unique constraint "users_email_key"',
      );
    });

    const result = await action();

    expect(result?.serverError).toBe('Something went wrong. Please try again.');
    expect(result?.serverError).not.toContain('users_email_key');
  });
});
