import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

const DAY = 86400000;

test.describe('Phase 6.2 — Daily Planning Ritual', () => {
  test('walks 3 steps and seeds the day\'s focus list', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    const now = Date.now();
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'od', title: 'Overdue report', deadline: now - 2 * DAY }),
        mkTask({ id: 't1', title: 'Draft proposal', deadline: now }),
        mkTask({ id: 't2', title: 'Email the team', deadline: now + DAY }),
      ],
    });

    // Step 0 — reschedule overdue.
    await expect(page.getByText('Plan your day')).toBeVisible();
    await page.getByRole('button', { name: 'Move to tomorrow' }).click();

    // Step 1 — pick a task to focus on.
    await expect(page.getByText('Pick up to 3 to focus on today.')).toBeVisible();
    await page.getByRole('button', { name: 'Draft proposal' }).click();
    await page.getByRole('button', { name: /Continue · 1/ }).click();

    // Step 2 — finish.
    await page.getByRole('button', { name: 'Start focused' }).click();

    // The chosen task id is persisted for today, and the ritual won't reappear.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const day = new Date();
          const p = (n: number) => String(n).padStart(2, '0');
          const key = `tody:focusList:${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}`;
          return JSON.parse(localStorage.getItem(key) || '[]');
        }),
      )
      .toContain('t1');
    expect(errors).toEqual([]);
  });

  test('does not reappear once dismissed for the day', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Only task', deadline: Date.now() })] });
    await page.getByRole('button', { name: 'Dismiss planning' }).click();
    await expect(page.getByText('Plan your day')).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Plan your day')).toHaveCount(0);
  });
});
