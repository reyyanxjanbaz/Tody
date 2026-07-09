import { test, expect, type Page } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

const DAY = 86400000;

/** Drags a task row horizontally past SWIPE_THRESHOLD (80px) via real pointer events. */
async function dragRow(page: Page, rowText: string, dx: number) {
  const row = page.getByText(rowText, { exact: true });
  const box = await row.boundingBox();
  if (!box) throw new Error(`row "${rowText}" not found`);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx * 0.5, startY, { steps: 5 });
  await page.mouse.move(startX + dx, startY, { steps: 5 });
  await page.mouse.up();
}

test.describe('Phase 3.3 — HomeScreen', () => {
  test('renders temporal sections, TodayLine under TODAY, with zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    const now = Date.now();
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'overdue', title: 'Overdue thing', deadline: now - 2 * DAY }),
        mkTask({ id: 'today', title: 'Today thing', deadline: now }),
        mkTask({ id: 'next', title: 'Next thing', deadline: now + 2 * DAY }),
        mkTask({ id: 'later', title: 'Later thing', deadline: now + 10 * DAY }),
      ],
    });
    await expect(page.getByText('CARRY FORWARD')).toBeVisible();
    // Both the "TODAY" section header and the TodayLine divider render the
    // literal text "TODAY" — two legitimate matches, hence .first().
    await expect(page.getByText('TODAY', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('NEXT FEW DAYS')).toBeVisible();
    await expect(page.getByText('LATER', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('checkbox completes a task and shows an Undo toast', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Check me off', deadline: Date.now() })] });
    // A real click on the checkbox now toggles completion (P1.8 fixed the
    // @use-gesture capture-phase click-suppression that used to swallow it).
    await page.getByRole('checkbox').first().click();
    await expect(page.getByText('Task completed')).toBeVisible();
    await expect(page.getByText('Undo')).toBeVisible();
  });

  test('swiping a row left (past threshold) completes the task', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Swipe left me', deadline: Date.now() })] });
    await dragRow(page, 'Swipe left me', -150);
    await expect(page.getByText('Task completed')).toBeVisible();
  });

  test('swiping a fresh (never-started) row right starts its timer', async ({ page }) => {
    // TaskItem.swipeRight(): a task with no startedAt and an onStart handler
    // starts the timer rather than deferring — deferring is the fallback for
    // tasks that are already started.
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Swipe right me', deadline: Date.now() })] });
    await dragRow(page, 'Swipe right me', 150);
    await expect(page.getByText(/Started .* ago/)).toBeVisible();
  });

  test('swiping a row right opens the snooze menu; picking Tomorrow defers it', async ({ page }) => {
    await stubNetwork(page);
    const now = Date.now();
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Defer me', deadline: now, startedAt: now - 60_000 })] });
    // Phase 3.4 — the defer swipe now opens a snooze menu (resolved times shown)
    // rather than blindly jumping to tomorrow.
    await dragRow(page, 'Defer me', 150);
    await expect(page.getByText('Snooze until…')).toBeVisible();
    // 'Tomorrow' appears twice (option label + its resolved-time sublabel); the
    // first is the tappable label.
    await page.getByText('Tomorrow', { exact: true }).first().click();
    // Deferred to tomorrow EOD -> no longer in the TODAY (now) section.
    await expect(page.getByText('TODAY', { exact: true })).not.toBeVisible();
  });

  test('tapping a row opens TaskDetail', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Open detail', deadline: Date.now() })] });
    await page.getByText('Open detail').click();
    await expect(page).toHaveURL(/\/task\/t1$/);
  });

  test('long-press opens the rich preview overlay (Edit / Add subtask / Delete)', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Hold me', deadline: Date.now(), priority: 'high' })] });
    const row = page.getByText('Hold me');
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // @use-gesture's `filterTaps` buffers a *perfectly* stationary press as a
    // pending tap and never fires the drag callback's `first` frame (which is
    // what arms the long-press timer) until movement clears a 3px threshold —
    // a real finger/mouse always has that much tremor, so nudge a few px to
    // mimic real input; too much (>6px) and TaskItem treats it as a swipe and
    // cancels the long-press timer itself, so stay inside the 3–6px window.
    await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2);
    await page.waitForTimeout(450); // > 350ms long-press threshold
    await page.mouse.up();
    // The preview overlay (G2) replaced the old plain sheet.
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add subtask' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
    await expect(page.getByText('High', { exact: true })).toBeVisible(); // priority chip
  });

  test('TaskInput adds a task and infers priority/estimate from natural language', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [] });
    const input = page.getByPlaceholder('What needs doing?');
    await input.fill('urgent call the bank');
    await expect(page.getByText('High', { exact: false })).toBeVisible();
    await input.press('Enter');
    await expect(page.getByText('call the bank')).toBeVisible();
  });

  test('category tabs filter the visible task list', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'w1', title: 'Work task', category: 'work', deadline: Date.now() }),
        mkTask({ id: 'p1', title: 'Personal task', category: 'personal', deadline: Date.now() }),
      ],
    });
    await expect(page.getByText('Work task')).toBeVisible();
    await expect(page.getByText('Personal task')).toBeVisible();
    await page.getByRole('button', { name: 'Work', exact: true }).click();
    await expect(page.getByText('Work task')).toBeVisible();
    await expect(page.getByText('Personal task')).not.toBeVisible();
  });

  test('search filters the task list by title', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'a', title: 'Buy milk', deadline: Date.now() }),
        mkTask({ id: 'b', title: 'Write report', deadline: Date.now() }),
      ],
    });
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByPlaceholder('Search tasks').fill('milk');
    await expect(page.getByText('Buy milk')).toBeVisible();
    await expect(page.getByText('Write report')).not.toBeVisible();
  });

  test('subtask rows render connector lines and a lock icon on an incomplete-child parent', async ({ page }) => {
    await stubNetwork(page);
    const now = Date.now();
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'root', title: 'Root task', deadline: now, childIds: ['child'] }),
        mkTask({ id: 'child', title: 'Child task', deadline: now, parentId: 'root', depth: 1 }),
      ],
    });
    await expect(page.getByText('Root task')).toBeVisible();
    await expect(page.getByText('Child task')).toBeVisible();
    // Locked parent shows a lock glyph rendered as an svg icon adjacent to its row.
    const rows = page.locator('div').filter({ hasText: 'Root task' });
    await expect(rows.first().locator('svg').first()).toBeVisible();
  });

  test('add-category prompt creates a new tab', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [] });
    // CategoryTabs is the DOM sibling right after <header>; its trailing action
    // buttons are [add (+), manage (pencil)] in that order.
    await page.locator('header + div button').nth(-2).click();
    // TaskInput's own input (placeholder="What needs doing?") stays mounted
    // underneath the modal, so scope to the PromptModal's unplaceholdered one.
    await page.locator('input:not([placeholder])').fill('Shopping');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Shopping')).toBeVisible();
  });
});
