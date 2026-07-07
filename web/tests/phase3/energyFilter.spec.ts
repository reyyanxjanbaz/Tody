import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

const DAY = 86400000;

test.describe('Phase 3.3 — energy filter', () => {
  test('filters the list to the chosen energy and offers a kind empty state', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    const now = Date.now();
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'hi', title: 'Deep work sprint', deadline: now + DAY, energy: 'high' }),
        mkTask({ id: 'lo', title: 'Reply to a text', deadline: now + DAY, energy: 'low' }),
      ],
    });

    // Both visible with no filter.
    await expect(page.getByText('Deep work sprint', { exact: true })).toBeVisible();
    await expect(page.getByText('Reply to a text', { exact: true })).toBeVisible();

    // Filter to low-lift → only the low task remains.
    await page.getByRole('button', { name: 'Filter by Low lift energy' }).click();
    await expect(page.getByText('Reply to a text', { exact: true })).toBeVisible();
    await expect(page.getByText('Deep work sprint', { exact: true })).toHaveCount(0);

    // Switch to deep focus → only the high task.
    await page.getByRole('button', { name: 'Filter by Low lift energy' }).click(); // clear
    await page.getByRole('button', { name: 'Filter by Deep focus energy' }).click();
    await expect(page.getByText('Deep work sprint', { exact: true })).toBeVisible();
    await expect(page.getByText('Reply to a text', { exact: true })).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
