import { test, expect } from '@playwright/test';
import { mkTask, seedApp, stubNetwork } from '../helpers/seed';

/**
 * G3 — Sort dropdown (native `src/components/SortDropdown.tsx`). Native Home
 * has a floating sort FAB opening a dropdown with 7 explicit sort orders
 * (Default/Deadline asc+desc/Priority high+low/Newest/Oldest). Web's Home has
 * no sort control at all — organizeTasks always uses the fixed urgency-score
 * ordering. EXPECTED TO FAIL until a SortDropdown is ported.
 */
test('Home has a sort control offering deadline/priority/creation-date orderings', async ({ page }) => {
  await stubNetwork(page);
  await seedApp(page, {
    tasks: [
      mkTask({ id: '1', title: 'Task one', deadline: Date.now() }),
      mkTask({ id: '2', title: 'Task two', deadline: Date.now() }),
    ],
  });

  // No sort affordance exists on web today — none of these locators resolve.
  await page.getByRole('button', { name: /sort/i }).click({ timeout: 3000 });
  await expect(page.getByText('Deadline — soonest')).toBeVisible();
  await expect(page.getByText('Priority — high first')).toBeVisible();
  await expect(page.getByText('Created — newest')).toBeVisible();
});
