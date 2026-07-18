import { expect, test } from '@playwright/test';
import { installMarketApiMock } from '@root/e2e/fixtures/markets';

test.describe('Crypto market dashboard', () => {
  test('renders the liquidity terminal from the typed ConnectRPC snapshot', async ({
    page,
  }) => {
    const runtimeErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    const marketApi = await installMarketApiMock(page);
    await page.setViewportSize({ width: 1600, height: 1000 });

    await page.goto('/');

    const chamber = page.getByRole('region', {
      name: 'Market gravity chamber',
    });
    const watch = page.getByRole('region', { name: 'Market watch' });
    await expect(page.getByRole('heading', { name: 'VIBE//X' })).toBeVisible();
    await expect(page.getByLabel('Market tape')).toBeVisible();
    await expect(chamber).toBeInViewport();
    await expect(watch).toBeInViewport();
    await expect(chamber.locator('img:visible')).toHaveCount(11);
    await expect(watch.locator('img')).toHaveCount(10);
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
    await watch.getByRole('button', { name: 'Select Ethereum' }).click();
    await expect(chamber.getByRole('status')).toContainText('ETH');
    await watch.getByRole('button', { name: 'Select Solana' }).click();
    await expect(chamber.getByRole('status')).toContainText('SOL');
    await expect.poll(marketApi.getRequestCount).toBe(1);
    expect(runtimeErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('keeps the mobile terminal usable without page overflow', async ({
    page,
  }) => {
    await installMarketApiMock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const chamber = page.getByRole('region', {
      name: 'Market gravity chamber',
    });
    const watch = page.getByRole('region', { name: 'Market watch' });
    await expect(page.getByRole('heading', { name: 'VIBE//X' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh market data' }),
    ).toBeVisible();
    await expect(chamber).toBeVisible();
    await expect(watch).toBeVisible();
    await expect(chamber.locator('img:visible')).toHaveCount(11);
    await expect(watch.locator('img')).toHaveCount(10);
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

  test.describe('with reduced motion', () => {
    test('keeps the gravity field visually static', async ({ page }) => {
      const marketApi = await installMarketApiMock(page);
      await page.setViewportSize({ width: 1200, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');

      const chamber = page.getByRole('region', {
        name: 'Market gravity chamber',
      });
      const canvas = chamber.locator('canvas');
      const visibleLogos = chamber.locator('img:visible');
      await expect(canvas).toBeVisible();
      await expect(chamber.locator('img:visible')).toHaveCount(11);
      expect(
        await page.evaluate(
          () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        ),
      ).toBe(true);
      await expect
        .poll(marketApi.getLogoRequestCount)
        .toBeGreaterThanOrEqual(10);
      await expect
        .poll(() =>
          chamber
            .locator('img:visible')
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      await page.waitForTimeout(500);
      const firstLogoLayout = await visibleLogos.evaluateAll((images) =>
        images.map((image) => {
          const rect = image.getBoundingClientRect();
          return {
            src: image.getAttribute('src'),
            x: Math.round(rect.x * 100),
            y: Math.round(rect.y * 100),
            width: Math.round(rect.width * 100),
            height: Math.round(rect.height * 100),
          };
        }),
      );
      await page.waitForTimeout(900);
      const secondLogoLayout = await visibleLogos.evaluateAll((images) =>
        images.map((image) => {
          const rect = image.getBoundingClientRect();
          return {
            src: image.getAttribute('src'),
            x: Math.round(rect.x * 100),
            y: Math.round(rect.y * 100),
            width: Math.round(rect.width * 100),
            height: Math.round(rect.height * 100),
          };
        }),
      );

      expect(secondLogoLayout).toEqual(firstLogoLayout);
    });
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
