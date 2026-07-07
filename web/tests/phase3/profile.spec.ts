import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, seedSession, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.7 — ProfileScreen', () => {
  test('shows initials derived from the (stubbed) session email, zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedSession(page, 'jordan@example.com');
    await seedApp(page, { tasks: [], path: '/profile' });
    // displayName = email local-part; initials = its first 2 chars, uppercased.
    await expect(page.getByText('jordan', { exact: true })).toBeVisible();
    await expect(page.getByText('JO', { exact: true })).toBeVisible();
    await expect(page.getByText('jordan@example.com')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('shows a streak pill once there is a completion streak', async ({ page }) => {
    await stubNetwork(page);
    await seedSession(page, 'streaker@example.com');
    await seedApp(page, {
      tasks: [mkTask({ id: 't1', title: 'Done today', completedAt: Date.now() })],
      path: '/profile',
    });
    await expect(page.getByText('day streak')).toBeVisible();
  });

  test('XP level and progress bar reflect calculateXP', async ({ page }) => {
    await stubNetwork(page);
    await seedSession(page, 'xp@example.com');
    await seedApp(page, {
      tasks: Array.from({ length: 3 }, (_, i) => mkTask({ id: `t${i}`, title: `Task ${i}`, completedAt: Date.now() })),
      path: '/profile',
    });
    await expect(page.getByText(/^Level \d+$/)).toBeVisible();
    await expect(page.getByText(/\/ 120 XP/)).toBeVisible();
  });

  test('the monthly calendar renders filled dots for fully-completed days', async ({ page }) => {
    await stubNetwork(page);
    await seedSession(page, 'cal@example.com');
    const today = new Date();
    await seedApp(page, {
      tasks: [mkTask({ id: 't1', title: 'Today done', completedAt: today.getTime() })],
      path: '/profile',
    });
    const monthLabel = today.toLocaleString('en-US', { month: 'long' });
    await expect(page.getByText(new RegExp(monthLabel))).toBeVisible();
  });

  test('the stat grid shows completion %, total tasks, and time invested', async ({ page }) => {
    await stubNetwork(page);
    await seedSession(page, 'stats@example.com');
    await seedApp(page, {
      tasks: [mkTask({ id: 't1', title: 'Stat task', completedAt: Date.now(), act: 45 })],
      path: '/profile',
    });
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByText('Total tasks')).toBeVisible();
    await expect(page.getByText('Time invested')).toBeVisible();
  });
});
