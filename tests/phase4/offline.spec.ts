import { test, expect } from '@playwright/test';

/**
 * Phase 4.5 — offline. Runs against the built dist/ via `vite preview`
 * (this file matches Playwright's "preview" project, see playwright.config.ts),
 * since the service worker only exists post-build.
 */
test('the app shell still renders with zero errors after the service worker takes over and the network is cut', async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto('/');
  // A freshly-registered SW activates but does not "claim" the page that's
  // already open (standard SW lifecycle) — it only starts controlling the
  // client from the next navigation onward, so reload once before checking
  // for a controller.
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), { timeout: 15_000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15_000 });

  await context.setOffline(true);
  await page.reload();

  // Unauthenticated shell -> Login screen, served entirely from the SW cache.
  await expect(page.getByText('ToDy')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Welcome back.')).toBeVisible();
  expect(pageErrors).toEqual([]);

  await context.setOffline(false);
});
