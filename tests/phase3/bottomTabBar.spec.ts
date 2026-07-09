import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

test.describe('Phase 4.1 — bottom tab bar', () => {
  test('navigates between Today, Calendar and Profile (Calendar was unreachable before)', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Anchor task', deadline: Date.now() })] });

    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();

    // Today is current on load.
    await expect(page.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');

    // Calendar — the only way to reach it is this tab.
    await page.getByRole('button', { name: 'Calendar' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page');

    // Profile.
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile$/);

    // Back to Today.
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page).toHaveURL(/\/$/);

    expect(errors).toEqual([]);
  });

  test('the tab bar is hidden on deep screens (task detail)', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Deep task', deadline: Date.now() })], path: '/task/t1' });
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
  });

  test('Habits tab is present and navigates to the habit tracker', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'x', deadline: Date.now() })] });
    await page.getByRole('button', { name: 'Habits' }).click();
    await expect(page).toHaveURL(/\/habits$/);
    await expect(page.getByRole('button', { name: 'Habits' })).toHaveAttribute('aria-current', 'page');
  });
});
