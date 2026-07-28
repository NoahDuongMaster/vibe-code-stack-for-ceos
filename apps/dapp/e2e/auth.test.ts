import { expect, test } from '@root/e2e/fixtures/base';

// Matches .env.sample locally / the e2e job env block in .github/workflows/ci.yml.
const EMAIL = process.env.DEMO_AUTH_EMAIL ?? 'admin@example.com';
const PASSWORD = process.env.DEMO_AUTH_PASSWORD ?? 'change-me-please';

test.describe('Auth flow', () => {
  test('unauthenticated visit to /account redirects to /sign-in with a callback', async ({
    page,
  }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=%2Faccount/);
  });

  test('signs in with valid credentials and reaches /account', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(/signed in as/i)).toBeVisible();
  });

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toHaveText(
      /sign in failed\. check your credentials and try again/i,
    );
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('loggedIn fixture seeds a session /account accepts without visiting /sign-in', async ({
    page,
    loggedIn: _loggedIn,
  }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(/signed in as/i)).toBeVisible();
  });
});

test.describe('Pre-hydration auth safety', () => {
  test.use({ javaScriptEnabled: false });

  test('never exposes credentials through a native GET submission', async ({
    page,
  }) => {
    await page.goto('/sign-in');

    const form = page.getByRole('button', { name: /sign in/i }).locator('..');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', /\/api\/auth\/login$/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeDisabled();

    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
