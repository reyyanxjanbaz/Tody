import { test, expect } from '@playwright/test';
import { mkTask, seedApp, stubNetwork } from '../helpers/seed';

/**
 * G1 — Pull-to-Focus (native `src/components/FocusMode.tsx`, "Feature 9:
 * Pull-to-Focus Mode"). Native Home has a Focus entry point (hold-to-activate
 * on the arc menu) that condenses the list to the top-3 tasks in a dedicated
 * FocusMode overlay. Web's HomeScreen has no Focus trigger and no FocusMode
 * component at all — this test is EXPECTED TO FAIL until it's ported.
 */
test('Home offers a Focus mode that narrows the list to the top-3 tasks', async ({ page }) => {
  await stubNetwork(page);
  await seedApp(page, {
    tasks: [
      mkTask({ id: '1', title: 'Task one', deadline: Date.now() }),
      mkTask({ id: '2', title: 'Task two', deadline: Date.now() }),
      mkTask({ id: '3', title: 'Task three', deadline: Date.now() }),
      mkTask({ id: '4', title: 'Task four', deadline: Date.now() }),
      mkTask({ id: '5', title: 'Task five', deadline: Date.now() }),
    ],
  });

  // No such affordance exists on web today — this locator will not resolve.
  // exact — the energy filter's "Deep focus" chip also contains "focus".
  await page.getByRole('button', { name: 'Focus', exact: true }).click({ timeout: 3000 });
  await expect(page.getByText('Task four')).not.toBeVisible();
  await expect(page.getByText('Task five')).not.toBeVisible();
});
