import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.6 — ArchiveScreen', () => {
  test('renders COMPLETED and OVERDUE ARCHIVED sections, zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [mkTask({ id: 'done', title: 'Completed task', completedAt: Date.now() })],
      archived: [mkTask({ id: 'arch', title: 'Archived task' })].map((t) => ({ ...t, isArchived: true, archivedAt: Date.now() })),
      path: '/archive',
    });
    await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible();
    await expect(page.getByText('OVERDUE ARCHIVED', { exact: true })).toBeVisible();
    await expect(page.getByText('Completed task')).toBeVisible();
    await expect(page.getByText('Archived task')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('search filters the archived/completed list', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'a', title: 'Alpha done', completedAt: Date.now() }),
        mkTask({ id: 'b', title: 'Beta done', completedAt: Date.now() }),
      ],
      path: '/archive',
    });
    await page.getByPlaceholder('Search archived tasks...').fill('Alpha');
    await expect(page.getByText('Alpha done')).toBeVisible();
    await expect(page.getByText('Beta done')).not.toBeVisible();
  });

  test('restoring a completed task uncompletes it', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Restore me', completedAt: Date.now() })], path: '/archive' });
    await page.getByRole('checkbox').first().click();
    await expect
      .poll(async () =>
        page.evaluate(() => JSON.parse(localStorage.getItem('@tody_tasks') || '[]').find((t: any) => t.id === 't1')?.isCompleted),
      )
      .toBe(false);
  });

  test('shows an empty state when there is nothing archived/completed', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/archive' });
    await expect(page.getByText('No archived tasks')).toBeVisible();
  });

  test('the sign-out button is present and clears local data on logout', async ({ page }) => {
    // Note: this suite authenticates via the DEV-only `__todyDevAuth` bypass
    // flag rather than a real Supabase session, and logout() only clears the
    // AsyncStorage KEYS (not that ad-hoc bypass flag) — so it does not
    // redirect to /login here the way it would for a real session. What we
    // can verify faithfully is that logout() actually wipes local task data.
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Some task', completedAt: Date.now() })], path: '/archive' });
    await expect(page.getByText('Sign out')).toBeVisible();
    await page.getByText('Sign out').click();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('@tody_tasks'))).toBeNull();
  });
});
