import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

/**
 * Social hub + decluttered Home header (usability rework). The hub gathers
 * friends / leaderboard / pacts / workspace sharing behind /social; the Home
 * header moves secondary actions into an overflow menu.
 */
test.describe('Social hub', () => {
  test('renders Friends & Pacts with empty states and zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, { path: '/social' });

    await expect(page.getByRole('heading', { name: 'Friends & Pacts' })).toBeVisible();
    // Empty states (no friends, no pacts — online data unavailable in tests).
    await expect(page.getByText('No friends yet')).toBeVisible();
    await expect(page.getByText('Make a pact')).toBeVisible();
    // The always-available invite affordance and pact create entry.
    await expect(page.getByLabel('Invite friends')).toBeVisible();
    await expect(page.getByLabel('New pact')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('Home header overflow menu', () => {
  test('secondary actions live behind a "More" menu (Sort, mode toggle)', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'A task', deadline: Date.now() })] });

    // The pact icon is gone from the header; secondary actions are in the menu.
    await page.getByLabel('More').click();
    await expect(page.getByText('Sort tasks')).toBeVisible();
    // Theme toggle label reflects current theme (dark default → "Light mode").
    await expect(page.getByText(/Light mode|Dark mode/)).toBeVisible();
  });
});
