import { test, expect } from '@playwright/test';
import { collectErrors, mkTask, seedSession, stubNetwork } from '../helpers/seed';

/**
 * Phase 4.10 — all-routes console sweep, against the production preview build.
 *
 * This runs in the "preview" Playwright project, where import.meta.env.DEV is
 * false — so the DEV-only `__todyDevAuth` bypass (verified absent from the
 * bundle by 4.8) is inert here, as intended. To reach the authenticated
 * routes we seed a real (fake) Supabase session via localStorage instead,
 * exactly as a genuinely logged-in user's browser would have it.
 */
const AUTHED_ROUTES = ['/', '/calendar', '/archive', '/process-inbox', '/reality-score', '/profile', '/settings'];

// Once active, the SW's own NetworkFirst fetch (for supabase/onrender calls)
// runs inside the service worker's execution context, not the page's — so it
// bypasses page.route() entirely and would hit the real network with a fake
// token. Service worker behavior itself is covered by offline.spec.ts and
// installability.spec.ts; block it here so this sweep is purely about
// whether each *screen* renders cleanly.
test.use({ serviceWorkers: 'block' });

test('every authenticated route renders with zero console errors or pageerrors', async ({ page }) => {
  const errors = collectErrors(page);
  await stubNetwork(page);
  // RealityScoreScreen assumes a truthy /profile/reality-score response always
  // has the full shape (it does `backend.recent_tasks.slice(...)` unguarded) —
  // stubNetwork's blanket `{}` for every onrender.com path crashes it. A real
  // backend wouldn't return that for this endpoint; this override keeps the
  // sweep focused on normal rendering. The underlying crash-on-malformed-
  // response gap itself is captured as its own regression in realityScore.spec.ts.
  await page.route(/\/profile\/reality-score/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reality_score: 0, underestimation_rate: 0, total_estimated_minutes: 0, total_actual_minutes: 0, recent_tasks: [] }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await seedSession(page, 'sweep@example.com');
  await page.evaluate((tasks) => {
    localStorage.setItem('@tody_tasks', JSON.stringify(tasks));
  }, [mkTask({ id: 't1', title: 'Sweep task', deadline: Date.now() })]);

  for (const route of AUTHED_ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.locator('#root')).not.toBeEmpty();
  }

  expect(errors).toEqual([]);
});

test('/task/:id and the unauthenticated Login/Register routes render with zero console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await stubNetwork(page);
  await seedSession(page, 'sweep2@example.com');
  await page.evaluate((tasks) => {
    localStorage.setItem('@tody_tasks', JSON.stringify(tasks));
  }, [mkTask({ id: 't1', title: 'Detail sweep task' })]);
  await page.goto('/task/t1', { waitUntil: 'networkidle' });
  await expect(page.getByText('Detail sweep task')).toBeVisible();

  await page.evaluate(() => localStorage.clear());
  await page.goto('/login', { waitUntil: 'networkidle' });
  await expect(page.getByText('ToDy')).toBeVisible();
  await page.goto('/register', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

  expect(errors).toEqual([]);
});
