import { expect, test } from '@playwright/test';
import { installMarketApiMock } from '@root/e2e/fixtures/markets';

test.describe('Crypto market dashboard', () => {
  test('renders the liquidity terminal from the typed ConnectRPC snapshot', async ({
    page,
  }) => {
    const marketApi = await installMarketApiMock(page);
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'VIBE//X' })).toBeVisible();
    await expect(page.getByLabel('Market tape')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Market watch' }),
    ).toBeInViewport();
    await expect(
      page.getByRole('button', { name: 'Select Avalanche' }),
    ).toBeInViewport();
    await expect(
      page.getByRole('heading', { name: 'Market pulse' }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('region', { name: 'Market pulse' }),
    ).toBeInViewport();
    await expect(
      page.getByRole('heading', { name: 'Market matrix' }),
    ).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(11);

    const fontRoles = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      display: getComputedStyle(document.querySelector('h1') as HTMLElement)
        .fontFamily,
      mono: getComputedStyle(
        document.querySelector(
          '[aria-label="Market tape"] strong',
        ) as HTMLElement,
      ).fontFamily,
    }));
    expect(fontRoles.body).toContain('Manrope');
    expect(fontRoles.display).toContain('Unbounded');
    expect(fontRoles.mono).toContain('IBM Plex Mono');
    await expect.poll(marketApi.getRequestCount).toBe(1);
  });

  test('keeps the mobile terminal usable without page overflow', async ({
    page,
  }) => {
    await installMarketApiMock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'VIBE//X' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh market data' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Market watch' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Market pulse' }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
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
