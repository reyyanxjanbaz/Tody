import { test, expect } from '@playwright/test';
import { collectErrors, mkInbox, seedApp, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.10 — ProcessInboxScreen', () => {
  test('shows the current inbox card and remaining count, zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, { inbox: [mkInbox('i1', 'Call the plumber'), mkInbox('i2', 'Buy milk')], path: '/process-inbox' });
    await expect(page.getByText('Call the plumber')).toBeVisible();
    await expect(page.getByText('2 left')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('"Make a task" expands the form, then "Create task" converts it and advances', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { inbox: [mkInbox('i1', 'Call the plumber')], path: '/process-inbox' });
    await page.getByText('Make a task').click();
    await expect(page.getByPlaceholder('Task title')).toHaveValue('Call the plumber');
    await page.getByText('Create task').click();
    await expect(page.getByText('Inbox zero')).toBeVisible();
  });

  test('"Done already" quick-completes and removes it from the inbox', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { inbox: [mkInbox('i1', 'Already done thing')], path: '/process-inbox' });
    await page.getByText('Done already').click();
    await expect(page.getByText('Inbox zero')).toBeVisible();
    await expect
      .poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('@tody_inbox_tasks') || '[]').length))
      .toBe(0);
  });

  test('"Discard" removes the item without creating a task', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { inbox: [mkInbox('i1', 'Throwaway thought')], path: '/process-inbox' });
    await page.getByText('Discard').click();
    await expect(page.getByText('Inbox zero')).toBeVisible();
    await expect
      .poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('@tody_tasks') || '[]').length))
      .toBe(0);
  });

  test('the capture memo box appends a new inbox item on Enter', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { inbox: [], path: '/process-inbox' });
    await page.getByPlaceholder('Capture a thought…').fill('Remember to stretch');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Remember to stretch')).toBeVisible();
  });

  test('an empty inbox shows "Inbox zero"', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { inbox: [], path: '/process-inbox' });
    await expect(page.getByText('Inbox zero')).toBeVisible();
  });
});
