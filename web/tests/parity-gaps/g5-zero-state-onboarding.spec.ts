import { test, expect } from '@playwright/test';
import { seedApp, stubNetwork } from '../helpers/seed';

/**
 * G5 — Zero-state onboarding (native `src/components/ZeroStateOnboarding.tsx`).
 * When a brand-new user has zero tasks in the "overview" category, native
 * shows a "Welcome to ToDy" screen with 3 selectable task-bundle templates
 * that seed starter tasks in one tap. Web's empty Home instead shows the
 * generic EmptyState ("Nothing here yet"). EXPECTED TO FAIL until template
 * onboarding is ported.
 */
test('a brand-new (zero-task) Home offers starter templates, not just a generic empty state', async ({ page }) => {
  await stubNetwork(page);
  await seedApp(page, { tasks: [] });

  await expect(page.getByText('Welcome to ToDy')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Create from scratch')).toBeVisible();
});
