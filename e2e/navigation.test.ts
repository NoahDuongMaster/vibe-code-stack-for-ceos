import { expect, test } from '@playwright/test';

test.describe('Navigation & Core Pages', () => {
  test('home page renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/AI-First Next\.js Boilerplate/i);
    expect(errors).toHaveLength(0);
  });

  test('404 page renders correctly for unknown route', async ({ page }) => {
    const response = await page.goto('/this-page-definitely-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('/api/health returns pass status', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pass');
    expect(body.time).toBeTruthy();
  });

  test('page has no broken image references', async ({ page }) => {
    const failedImages: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (
        (url.endsWith('.png') ||
          url.endsWith('.jpg') ||
          url.endsWith('.svg') ||
          url.endsWith('.webp')) &&
        response.status() >= 400
      ) {
        failedImages.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(failedImages).toHaveLength(0);
  });

  test('page has accessible heading structure', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });

  test('interactive elements are keyboard-navigable', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});
