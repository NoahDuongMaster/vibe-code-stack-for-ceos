import { expect, test } from '@playwright/test';
import { installMarketApiMock } from '@root/e2e/fixtures/markets';

test('home page loads', async ({ page }) => {
  await installMarketApiMock(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Vibe Markets/i);
});

test('404 returns 404 status for /non-existent-xyz', async ({ page }) => {
  const response = await page.goto('/non-existent-xyz');
  expect(response?.status()).toBe(404);
});

test('/api/health returns 200', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
});
