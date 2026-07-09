import { test, expect } from '@playwright/test';

test.describe('Phase 4.6 — installability', () => {
  test('links a web manifest and registers a controlling service worker', async ({ page }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    // See offline.spec.ts: a freshly-registered SW doesn't control the page
    // that registered it until the next navigation, so reload once first.
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), { timeout: 15_000 });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15_000 });
  });

  test('every icon declared in the manifest is fetchable (200)', async ({ page, request, baseURL }) => {
    await page.goto('/');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(new URL(manifestHref!, baseURL).toString())).json();
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const res = await request.get(new URL(icon.src, baseURL).toString());
      expect(res.status(), icon.src).toBe(200);
    }
  });

  test('exposes the apple-touch-icon and iOS standalone meta tags', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"][content="yes"]')).toHaveCount(1);
  });
});
