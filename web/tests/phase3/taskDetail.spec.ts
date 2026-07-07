import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, stubNetwork } from '../helpers/seed';

test.describe('Phase 3.4 — TaskDetailScreen', () => {
  test('loads a seeded task with zero console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [mkTask({ id: 't1', title: 'Existing task', description: 'Some notes' })],
      path: '/task/t1',
    });
    await expect(page.getByPlaceholder('Task title')).toHaveValue('Existing task');
    await expect(page.getByPlaceholder('Add notes...')).toHaveValue('Some notes');
    expect(errors).toEqual([]);
  });

  test('editing the title and blurring persists it to localStorage', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Old title' })], path: '/task/t1' });
    const titleBox = page.getByPlaceholder('Task title');
    await titleBox.fill('New title');
    await titleBox.blur();
    await expect
      .poll(async () =>
        page.evaluate(() => JSON.parse(localStorage.getItem('@tody_tasks') || '[]').find((t: any) => t.id === 't1')?.title),
      )
      .toBe('New title');
  });

  test('the priority pill cycles none -> low -> medium -> high and persists each step', async ({ page }) => {
    await stubNetwork(page);
    // energy: 'high' -> EnergyPill shows "Deep focus", never colliding with
    // PriorityPill's plain "Low"/"Medium"/"High" labels as priority cycles.
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Task', priority: 'none', energy: 'high' })], path: '/task/t1' });
    const readPriority = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('@tody_tasks') || '[]').find((t: any) => t.id === 't1')?.priority);

    const pill = page.getByRole('button', { name: 'Priority' });
    await pill.click();
    await expect(page.getByRole('button', { name: 'Low' })).toBeVisible();
    await expect.poll(readPriority).toBe('low');

    await page.getByRole('button', { name: 'Low' }).click();
    await expect(page.getByRole('button', { name: 'Medium' })).toBeVisible();
    await expect.poll(readPriority).toBe('medium');

    await page.getByRole('button', { name: 'Medium' }).click();
    await expect(page.getByRole('button', { name: 'High' })).toBeVisible();
    await expect.poll(readPriority).toBe('high');
  });

  test('Start timer -> Complete (stop timer) flow marks the task done', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Timed task' })], path: '/task/t1' });
    await page.getByText('Start timer').click();
    await expect(page.getByText('Complete (stop timer)')).toBeVisible();
    await page.getByText('Complete (stop timer)').click();
    await expect(page.getByText('Restore task')).toBeVisible();
  });

  test('Mark as done then Restore task round-trips completion', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Simple task' })], path: '/task/t1' });
    await page.getByText('Mark as done').click();
    await expect(page.getByText('Restore task')).toBeVisible();
    await page.getByText('Restore task').click();
    await expect(page.getByText('Mark as done')).toBeVisible();
  });

  test('deleting a leaf task (confirm) navigates back home', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 't1', title: 'Delete me' })], path: '/task/t1' });
    page.once('dialog', (d) => d.accept());
    // The bottom icon-only action bar renders [back, delete] as the last 2 of 3
    // trailing unlabeled buttons on the page (the 3rd is the top-left back button,
    // which sits last in DOM order despite being visually pinned to the top).
    await page.getByRole('button').nth(-2).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('an unknown task id shows "Task not found"', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [], path: '/task/does-not-exist' });
    await expect(page.getByText('Task not found')).toBeVisible();
  });

  test('adding a subtask via the sheet creates a child row', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, { tasks: [mkTask({ id: 'parent', title: 'Parent task' })], path: '/task/parent' });
    await page.getByText('Add subtask').click();
    await page.getByPlaceholder('What needs doing?').fill('Child subtask');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Child subtask')).toBeVisible();
  });

  test('"Go to parent task" navigates to the parent', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, {
      tasks: [
        mkTask({ id: 'parent', title: 'Parent task', childIds: ['child'] }),
        mkTask({ id: 'child', title: 'Child task', parentId: 'parent', depth: 1 }),
      ],
      path: '/task/child',
    });
    await page.getByText('Go to parent task').click();
    await expect(page).toHaveURL(/\/task\/parent$/);
  });
});
