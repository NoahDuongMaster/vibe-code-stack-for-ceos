import { test as base, expect } from '@playwright/test';

type Fixtures = {
  /**
   * Placeholder fixture for future authenticated sessions.
   * Extend this to set cookies / localStorage for a logged-in user
   * before each test that requires authentication.
   */
  loggedIn: undefined;
};

export const test = base.extend<Fixtures>({
  loggedIn: async ({ page: _page }, use) => {
    // TODO: implement authentication setup
    // e.g. set iron-session cookie via page.context().addCookies([...])
    await use(undefined);
    // TODO: implement authentication teardown if needed
  },
});

export { expect };
