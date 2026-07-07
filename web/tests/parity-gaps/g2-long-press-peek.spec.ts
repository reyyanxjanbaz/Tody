import { test, expect } from '@playwright/test';
import { mkTask, seedApp, stubNetwork } from '../helpers/seed';

/**
 * G2 — Long-press peek (native `src/components/TaskPreviewOverlay.tsx`,
 * "Feature 3: Long-Press Preview"). Native long-press opens a rich preview
 * card showing the task's priority + energy labels ("High", "Medium Focus",
 * etc.) before offering Edit/Add subtask/Delete. Web's long-press instead
 * opens a plain action-sheet with no preview — this is a DIVERGENT
 * implementation, not just a missing one, and this test is EXPECTED TO FAIL
 * until the rich preview overlay is ported.
 */
test('long-press on a task opens a rich preview (priority + energy labels), not just a plain action sheet', async ({ page }) => {
  await stubNetwork(page);
  await seedApp(page, {
    tasks: [mkTask({ id: 't1', title: 'Peek me', deadline: Date.now(), priority: 'high', energy: 'high' })],
  });

  const row = page.getByText('Peek me');
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // See home.spec.ts's long-press test: a few px of movement is required to
  // clear @use-gesture's tap-filtering threshold and actually arm the timer.
  await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2);
  await page.waitForTimeout(450);
  await page.mouse.up();

  // Native's TaskPreviewOverlay renders the task's energy/priority as labeled
  // text ("High Focus") — web's action sheet only lists Edit/Defer/Delete.
  await expect(page.getByText('High Focus')).toBeVisible({ timeout: 3000 });
});
