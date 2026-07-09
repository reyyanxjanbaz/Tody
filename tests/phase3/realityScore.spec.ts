import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedApp, seedSession, stubNetwork } from '../helpers/seed';

function completedWithEstimate(id: string, est: number, act: number) {
  return mkTask({ id, title: `Task ${id}`, completedAt: Date.now(), est, act });
}

test.describe('Phase 3.8 — RealityScoreScreen', () => {
  test('with under 10 estimated+completed tasks, shows "Not enough data yet" and an N-of-10 counter', async ({ page }) => {
    const errors = collectErrors(page);
    await stubNetwork(page);
    await seedApp(page, {
      tasks: Array.from({ length: 4 }, (_, i) => completedWithEstimate(`t${i}`, 30, 30)),
      path: '/reality-score',
    });
    await expect(page.getByText('Not enough data yet')).toBeVisible();
    await expect(page.getByText('4 of 10 tasks completed')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('with >=10 estimated+completed tasks, shows the accuracy % and two-series chart', async ({ page }) => {
    await stubNetwork(page);
    // Actual double the estimate for every task -> underestimation branch, deterministic 50% score.
    await seedApp(page, {
      tasks: Array.from({ length: 10 }, (_, i) => completedWithEstimate(`t${i}`, 30, 60)),
      path: '/reality-score',
    });
    await expect(page.getByText(/^\d+%$/)).toBeVisible();
    await expect(page.getByText('estimate accuracy')).toBeVisible();
    await expect(page.getByText(/You typically underestimate by \d+%/)).toBeVisible();
    await expect(page.locator('svg polyline')).toHaveCount(2);
    // exact:true — the "actual"/"estimated" duration labels above the chart
    // and the "Actual"/"Estimated" legend dots below it differ only in case.
    await expect(page.getByText('Actual', { exact: true })).toBeVisible();
    await expect(page.getByText('Estimated', { exact: true })).toBeVisible();
  });

  test('overestimating branch copy renders when actual < estimated', async ({ page }) => {
    await stubNetwork(page);
    await seedApp(page, {
      tasks: Array.from({ length: 10 }, (_, i) => completedWithEstimate(`t${i}`, 60, 30)),
      path: '/reality-score',
    });
    await expect(page.getByText(/You typically overestimate by \d+%/)).toBeVisible();
  });

  // P1.7 regression: RealityScoreScreen used to do `backend.recent_tasks.slice`
  // on any truthy /profile/reality-score response without checking its shape,
  // crashing (blank screen) on a malformed/incomplete payload. It now validates
  // the payload (isValidRealityPayload) and falls back to local stats.
  test('does not crash when the backend /profile/reality-score response is missing fields', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await stubNetwork(page);
    await page.route(/\/profile\/reality-score/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}', // truthy, but missing recent_tasks/reality_score/etc.
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
    );
    await seedSession(page, 'crash-repro@example.com');
    await page.evaluate(
      (tasks) => localStorage.setItem('@tody_tasks', JSON.stringify(tasks)),
      Array.from({ length: 10 }, (_, i) => completedWithEstimate(`t${i}`, 30, 60)),
    );
    await page.goto('/reality-score', { waitUntil: 'networkidle' });

    await expect(page.locator('#root')).not.toBeEmpty();
    expect(pageErrors).toEqual([]);
  });
});
