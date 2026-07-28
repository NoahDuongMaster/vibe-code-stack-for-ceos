import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:46000';
const useProductionServer =
  !!process.env.CI || process.env.PLAYWRIGHT_PRODUCTION === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  outputDir: './e2e-results',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        // CI's e2e job already runs `pnpm build` as a separate step before
        // this—start the production build we just made, so the tests exercise
        // what would actually ship.
        command: useProductionServer ? 'pnpm start' : 'pnpm dev',
        url: 'http://localhost:46000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
