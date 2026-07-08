import { expect, test } from './fixtures/base';

// Matches .env.sample locally / the CI env block in .github/workflows/playwright.yml.
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

    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
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
