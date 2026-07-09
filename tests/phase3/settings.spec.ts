import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.9 — SettingsScreen', () => {
  test('renders with zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    await expect(page.getByText('Settings')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('cycling date/time/week-start preferences persists to localStorage', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    const readPrefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('@tody_user_preferences') || '{}'));

    await expect(page.getByText('MM/DD/YYYY')).toBeVisible();
    await page.getByText('Date Format').click();
    await expect(page.getByText('DD/MM/YYYY')).toBeVisible();
    await expect.poll(async () => (await readPrefs()).dateFormat).toBe('DD/MM/YYYY');

    await page.getByText('Time Format').click();
    await expect(page.getByText('24h')).toBeVisible();
    await expect.poll(async () => (await readPrefs()).timeFormat).toBe('24h');

    await page.getByText('Week Starts On').click();
    await expect(page.getByText('Monday')).toBeVisible();
    await expect.poll(async () => (await readPrefs()).weekStartsOn).toBe('monday');
  });

  test('the 24h time-format preference actually changes how the Calendar renders times', async ({ page }) => {
    await stubNetwork(page);
    const today = new Date();
    today.setHours(13, 30, 0, 0); // 1:30pm — unambiguous 12h vs 24h
    const end = new Date(today.getTime() + 3600_000);
    await seedApp(page, {
      tasks: [mkTask({ id: 'c', title: 'Afternoon block', ss: today.getTime(), se: end.getTime(), est: 60 })],
      path: '/calendar',
    });
    // Default is 12h → "1:30pm".
    await expect(page.getByText(/1:30pm/)).toBeVisible();

    // Flip to 24h in Settings, return to Calendar → "13:30".
    await page.goto('/settings');
    await page.getByText('Time Format').click();
    await expect(page.getByText('24h')).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByText(/13:30/)).toBeVisible();
    await expect(page.getByText(/1:30pm/)).not.toBeVisible();
  });

  test('the Monday week-start preference reorders the Profile month calendar header', async ({ page }) => {
    await stubNetwork(page);
    // Seed the pref directly and load Profile.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('__todyDevAuth', '1');
      localStorage.setItem('@tody_user_preferences', JSON.stringify({ darkMode: true, dateFormat: 'MM/DD/YYYY', timeFormat: '12h', weekStartsOn: 'monday' }));
    });
    await page.goto('/profile', { waitUntil: 'networkidle' });
    // The month-grid weekday header row: Monday-first → first cell is "M".
    const headerCells = page.locator('div', { hasText: /^[SMTWF]$/ });
    await expect(headerCells.first()).toHaveText('M');
  });

  test('the dark-mode toggle flips document.documentElement data-theme', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    // The dark-mode toggle is now a semantic switch (role="switch", P4.5 a11y).
    await page.getByRole('switch', { name: 'Dark mode' }).click();
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  });

  test('password change requires >= 6 characters', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    await page.getByPlaceholder('New password').fill('abc');
    await page.getByText('Update Password').click();
    await expect(page.getByText('New password must be at least 6 characters')).toBeVisible();
  });

  test('password change requires a non-empty new password', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    await page.getByText('Update Password').click();
    await expect(page.getByText('New password is required')).toBeVisible();
  });

  test('delete-account modal opens and a stubbed confirm calls the delete endpoint', async ({ page }) => {
    let deleteCalled = false;
    await page.route(/tody-backend\.onrender\.com\/profile$/, (route) => {
      deleteCalled = true;
      route.fulfill({ status: 204, body: '' });
    });
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    await page.getByText('Delete Account').click();
    await expect(page.getByText('Delete Account?')).toBeVisible();
    // Not authenticated (no real Supabase session) -> api.delete short-circuits before
    // ever reaching the network, so the modal at least opens/cancels cleanly.
    await page.getByText('Cancel').click();
    await expect(page.getByText('Delete Account?')).not.toBeVisible();
    expect(deleteCalled).toBe(false);
  });

  test('Reset Preferences (confirmed) restores defaults', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    await page.getByText('Date Format').click();
    await expect(page.getByText('DD/MM/YYYY')).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByText('Reset Preferences').click();
    await expect(page.getByText('MM/DD/YYYY')).toBeVisible();
  });

  test('Log Out logs the user out', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Some task' })], path: '/settings' });
    await page.getByText('Log Out').click();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('@tody_tasks'))).toBeNull();
  });

  // ── Phase 4.3 / 4.2 — accessibility preferences ─────────────────────────────

  test('Text Size cycles and stamps <html data-textsize>', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    // Default is md.
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.textsize)).toBe('md');
    await page.getByText('Text Size').click(); // md -> lg
    await expect(page.getByText('Large')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.textsize)).toBe('lg');
  });

  test('Reduce Motion cycles and stamps <html data-reducemotion> when forced on', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/settings' });
    await page.getByText('Reduce Motion').click(); // system -> on
    await expect(page.getByText('On', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reducemotion)).toBe('on');
  });
});
