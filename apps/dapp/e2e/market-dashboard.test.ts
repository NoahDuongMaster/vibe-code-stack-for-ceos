import { expect, test } from '@playwright/test';
import { installMarketApiMock } from '@root/e2e/fixtures/markets';

test.describe('Crypto market dashboard', () => {
  test('renders the typed ConnectRPC market snapshot', async ({ page }) => {
    const marketApi = await installMarketApiMock(page);

    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Vibe Markets' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Market matrix' }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(11);
    await expect(page.getByText('$3.6T')).toBeVisible();
    await expect(page.getByText('SOL +5.86%')).toBeVisible();
    await expect(page.getByText('5 gainers / 3 losers')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Highlight Bitcoin in 3D' }),
    ).toBeVisible();
    await expect.poll(marketApi.getRequestCount).toBe(1);
  });

  test('recovers when the gateway becomes available after retry', async ({
    page,
  }) => {
    const marketApi = await installMarketApiMock(page, {
      failFirstRequests: 3,
    });

    await page.goto('/');

    await expect.poll(marketApi.getRequestCount, { timeout: 15_000 }).toBe(3);
    await expect(page.getByRole('alert')).toContainText(
      'Market data is temporarily unavailable.',
    );

    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(
      page.getByRole('heading', { name: 'Market matrix' }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect.poll(marketApi.getRequestCount).toBe(4);
  });
});
