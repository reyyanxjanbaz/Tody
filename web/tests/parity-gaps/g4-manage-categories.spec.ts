import { test, expect } from '@playwright/test';
import { seedApp, stubNetwork } from '../helpers/seed';

/**
 * G4 — Manage-categories modal (native `src/components/ManageCategoriesModal.tsx`).
 * Native has a dedicated rename/delete/reorder UI for categories, opened from
 * Home's category tab bar "manage" (pencil) button. Web's pencil button
 * currently just navigates to /settings, which has no category management UI
 * at all — this test is EXPECTED TO FAIL until a ManageCategoriesModal (or
 * equivalent) is ported.
 */
test('the category "manage" (pencil) button opens rename/delete/reorder UI for categories', async ({ page }) => {
  await stubNetwork(page);
  await seedApp(page, { tasks: [] });

  // CategoryTabs' trailing action buttons are [add, manage] — click "manage".
  await page.locator('header + div button').last().click();

  // The ManageCategoriesModal lists each non-default category with rename +
  // delete + reorder controls, in-place (no navigation to /settings).
  await expect(page.getByText('Manage categories')).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('button', { name: 'Delete Work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rename Work' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move Work down' })).toBeVisible();
  await expect(page).not.toHaveURL(/\/settings$/);
});
