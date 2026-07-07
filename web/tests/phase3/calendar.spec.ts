import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.5 — CalendarScreen', () => {
  test('renders COMMITTED/DUE/FLEXIBLE/NEEDS A RESET sections from seeded tasks, zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    const now = Date.now();
    const today = new Date();
    today.setHours(11, 0, 0, 0);
    const in1h = new Date(today.getTime() + 3600_000);
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'committed', title: 'Scheduled block', ss: today.getTime(), se: in1h.getTime(), est: 60 }),
        // Only an exact end-of-day (23:59) deadline lands in DUE THIS DAY —
        // any other deadline on the selected day is treated as a timed
        // commitment and sorted into COMMITTED instead (calendarDayboard.ts).
        mkTask({ id: 'due', title: 'Due today task', deadline: new Date().setHours(23, 59, 0, 0) }),
        mkTask({ id: 'flex', title: 'Flexible task', est: 30 }),
        mkTask({ id: 'reset', title: 'Overdue reset task', deadline: now - 3 * 86400000 }),
      ],
      path: '/calendar',
    });
    await expect(page.getByText('COMMITTED')).toBeVisible();
    await expect(page.getByText('DUE THIS DAY')).toBeVisible();
    // exact:true — "Flexible task" (the row title) also contains "FLEXIBLE"
    // case-insensitively, colliding with the section label.
    await expect(page.getByText('FLEXIBLE', { exact: true })).toBeVisible();
    await expect(page.getByText('NEEDS A RESET')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('changing the strip date re-renders the dayboard for the new day', async ({ page }) => {
    await stubNetwork(page);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow.getTime() + 3600_000);
    // getDayboardData's FLEXIBLE bucket is a date-agnostic catch-all for any
    // active task that isn't committed/due *for the currently viewed day* —
    // so a scheduled-tomorrow task still shows today, just under FLEXIBLE
    // instead of COMMITTED. Switching to tomorrow's date should promote it.
    await seedApp(page, {
      tasks: [mkTask({ id: 't1', title: 'Tomorrow block', ss: tomorrow.getTime(), se: tomorrowEnd.getTime(), est: 60 })],
      path: '/calendar',
    });
    await expect(page.getByText('FLEXIBLE', { exact: true })).toBeVisible();
    await expect(page.getByText('COMMITTED', { exact: true })).not.toBeVisible();

    // CalendarStrip (the DOM sibling right after <header>) always renders a
    // fixed PAST(14)..FUTURE(14) window of buttons in date order, so "tomorrow"
    // is reliably the button at index 15 — a bare getByText(dayNumber) risks
    // matching the header's "<Month> <day>" title instead, which isn't clickable.
    await page.locator('header + div button').nth(15).click();

    await expect(page.getByText('COMMITTED', { exact: true })).toBeVisible();
    await expect(page.getByText('Tomorrow block')).toBeVisible();
  });

  test('shows a status text summary and a row checkbox that completes the task', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [mkTask({ id: 't1', title: 'Complete via calendar', deadline: new Date().setHours(22, 0, 0, 0) })],
      path: '/calendar',
    });
    await expect(page.getByText('Complete via calendar')).toBeVisible();
    await page.getByRole('checkbox').first().click();
    await expect
      .poll(async () =>
        page.evaluate(() => JSON.parse(localStorage.getItem('@tody_tasks') || '[]').find((t: any) => t.id === 't1')?.isCompleted),
      )
      .toBe(true);
  });

  test('an empty day shows the "Nothing planned" placeholder', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/calendar' });
    await expect(page.getByText('Nothing planned for this day.')).toBeVisible();
  });

  test('back chevron returns to Home', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/calendar' });
    await page.locator('header button').first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});
