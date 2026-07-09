import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 3 (screen E2E) runs against the fast dev server.
 * Phase 4 (offline / SW / installability) runs against the built `dist/`
 * served by `vite preview`, since the service worker only exists post-build.
 */
const DEV_PORT = 5183;
const PREVIEW_PORT = 4183;

export default defineConfig({
  testDir: './tests',
  testMatch: ['phase3/**/*.spec.ts', 'phase4/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    viewport: { width: 400, height: 850 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'dev',
      testMatch: ['phase3/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      name: 'preview',
      testMatch: ['phase4/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${DEV_PORT}`,
      port: DEV_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm run build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      port: PREVIEW_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
