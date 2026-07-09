import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkTask, seedApp, stubNetwork } from '../helpers/seed';

/**
 * Phase 4.5 — automated accessibility sweep. Runs axe-core against the main
 * surfaces and fails on serious/critical violations (colour contrast, names,
 * roles, ARIA). Scoped to those impact levels so minor best-practice nits
 * don't block, but real barriers do.
 */
async function scan(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
}

function serious(results: Awaited<ReturnType<typeof scan>>) {
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('Phase 4.5 — a11y sweep', () => {
  test('Home has no serious accessibility violations', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [
        mkTask({ id: 't1', title: 'Accessible task', deadline: Date.now(), priority: 'high', energy: 'high' }),
        mkTask({ id: 't2', title: 'Another task', deadline: Date.now() + 86400000 }),
      ],
    });
    await expect(page.getByText('Accessible task')).toBeVisible();
    expect(serious(await scan(page))).toEqual([]);
  });

  test('Calendar has no serious accessibility violations', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Cal task', deadline: Date.now() })], path: '/calendar' });
    expect(serious(await scan(page))).toEqual([]);
  });

  test('Habits has no serious accessibility violations', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { path: '/habits' });
    await page.evaluate(() => localStorage.setItem('tody:habits', JSON.stringify([{
      id: 'h1', name: 'Read', icon: 'book-outline', color: '#8B5CF6', scheduleType: 'daily',
      scheduleDays: [], scheduleTarget: 1, timeOfDay: 'anytime', energyLevel: 'low', tinyVersion: '',
      reminderTime: null, order: 0, createdAt: Date.now() - 8.64e7, updatedAt: Date.now() - 8.64e7,
      archivedAt: null, deletedAt: null,
    }])));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Read', { exact: true })).toBeVisible();
    expect(serious(await scan(page))).toEqual([]);
  });

  test('Settings has no serious accessibility violations', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { path: '/settings' });
    await expect(page.getByText('ACCESSIBILITY')).toBeVisible();
    expect(serious(await scan(page))).toEqual([]);
  });
});
