import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'test/e2e-real',
  testMatch: '**/*.real.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx serve -s dist -l ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },
});
