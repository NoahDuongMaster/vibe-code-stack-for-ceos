import { test as base, expect } from '@playwright/test';
import { sealData } from 'iron-session';

// Mirrors src/shared/constants/session.constant.ts / server/lib/session.ts —
// e2e tests run as a separate Playwright/Node process and can't import the
// app's own TS modules directly, so the cookie name and secret fallback are
// duplicated here deliberately.
const SESSION_COOKIE_NAME = 'app-session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'dev-session-secret-min-32-chars!!';

type Fixtures = {
  /**
   * Seeds a valid, sealed iron-session cookie directly (bypassing the login
   * UI) for tests where an authenticated session is a precondition, not the
   * thing under test. See e2e/auth.test.ts for a test that drives the real
   * login UI end-to-end instead.
   */
  loggedIn: undefined;
};

export const test = base.extend<Fixtures>({
  loggedIn: async ({ page, baseURL }, use) => {
    const sealed = await sealData(
      {
        isLoggedIn: true,
        user: { id: 'e2e-user', email: 'e2e@example.com', name: 'E2E User' },
      },
      { password: SESSION_SECRET },
    );

    const url = new URL(baseURL ?? 'http://localhost:3000');
    await page.context().addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: sealed,
        domain: url.hostname,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: url.protocol === 'https:',
      },
    ]);

    await use(undefined);
  },
});

export { expect };
