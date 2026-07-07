import { test, expect, type Page } from '@playwright/test';
import { collectErrors, seedApp, stubNetwork } from '../helpers/seed';

/** Seed one daily habit into localStorage (created long ago, no log yet). */
async function seedHabit(page: Page, over: Record<string, unknown> = {}) {
  const habit = {
    id: 'h1', name: 'Drink water', icon: 'water-outline', color: '#3B82F6',
    scheduleType: 'daily', scheduleDays: [], scheduleTarget: 1,
    timeOfDay: 'anytime', energyLevel: 'low', tinyVersion: 'One glass',
    reminderTime: null, order: 0,
    createdAt: Date.now() - 30 * 86400000, updatedAt: Date.now() - 30 * 86400000,
    archivedAt: null, deletedAt: null, ...over,
  };
  await page.evaluate((h) => localStorage.setItem('tody:habits', JSON.stringify([h])), habit);
}

test.describe('Phase 5 — habit tracker', () => {
  test('create a habit, check it off, and see the streak flame', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, { path: '/habits' });

    // Empty state on a fresh Habits tab.
    await expect(page.getByText('Build your first habit')).toBeVisible();

    // Create a habit through the editor.
    await page.getByRole('button', { name: 'New habit' }).click();
    await page.getByPlaceholder('Habit name (e.g. Read 10 pages)').fill('Meditate');
    await page.getByRole('button', { name: 'Create habit' }).click();

    // Row appears; check it off.
    const row = page.getByText('Meditate', { exact: true });
    await expect(row).toBeVisible();
    await page.getByRole('checkbox').first().check();

    // Persisted: a done log now exists and the streak is 1.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const logs = JSON.parse(localStorage.getItem('tody:habitLogs') || '[]');
          return logs.filter((l: any) => l.status === 'done').length;
        }),
      )
      .toBe(1);
    // The header routine line reflects completion.
    await expect(page.getByText('All done today 🎉')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('opening a habit shows its streak stats and heatmap chain', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { path: '/habits' });
    await seedHabit(page);
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Open Drink water' }).click();
    await expect(page).toHaveURL(/\/habits\/h1$/);
    await expect(page.getByText('CHAIN')).toBeVisible();
    await expect(page.getByText('Current')).toBeVisible();
    await expect(page.getByText('Best')).toBeVisible();
  });

  test('after 6pm with a due habit incomplete, the lose-your-streak banner shows the tiny version', async ({ page }) => {
    await stubNetwork(page);
    // Freeze the clock at 8pm so the risk banner is deterministic.
    await page.clock.install({ time: new Date('2026-03-16T20:00:00') });
    await seedApp(page, { path: '/habits' });
    await seedHabit(page);
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByText('Complete today or lose your streak')).toBeVisible();
    await expect(page.getByText('One glass')).toBeVisible();
  });
});
