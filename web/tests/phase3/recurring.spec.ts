import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

const DAY = 86400000;

test.describe('Phase 3.1 — recurring tasks', () => {
  test('completing a recurring task spawns a fresh future instance', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    const now = Date.now();
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'rec', title: 'Take vitamins', deadline: now + DAY, recurring: 'daily' }),
      ],
    });

    // One instance to start.
    await expect(page.getByText('Take vitamins', { exact: true })).toHaveCount(1);

    // Complete it via its checkbox.
    await page.getByRole('checkbox').first().click();
    await expect(page.getByText('Task completed')).toBeVisible();

    // Verify against persisted state (robust to how completed rows render):
    // the original is now completed AND a fresh uncompleted instance was spawned
    // with a later deadline.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = JSON.parse(localStorage.getItem('@tody_tasks') || '[]') as Array<{
            title: string; isCompleted: boolean;
          }>;
          const vits = raw.filter((t) => t.title === 'Take vitamins');
          return {
            total: vits.length,
            completed: vits.filter((t) => t.isCompleted).length,
            open: vits.filter((t) => !t.isCompleted).length,
          };
        }),
      )
      .toEqual({ total: 2, completed: 1, open: 1 });
    expect(errors).toEqual([]);
  });
});
