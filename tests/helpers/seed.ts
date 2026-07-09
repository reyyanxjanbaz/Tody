import type { Page } from '@playwright/test';
import { SUPABASE_URL } from '../../src/core/lib/env';

export const DAY = 86400000;

/**
 * supabase-js derives its localStorage auth-token key from the project ref in
 * the URL: `sb-<ref>-auth-token`. Derive it here so switching Supabase projects
 * in env.ts never silently breaks seedSession (it did once — a hardcoded old
 * ref meant every seeded session read as logged-out).
 */
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
export const SUPABASE_AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;

export interface SeedTaskOverrides {
  id: string;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low' | 'none';
  energy?: 'high' | 'medium' | 'low';
  deadline?: number | null;
  est?: number | null;
  act?: number | null;
  completedAt?: number | null;
  startedAt?: number | null;
  deferCount?: number;
  parentId?: string | null;
  childIds?: string[];
  depth?: number;
  category?: string;
  ss?: number | null; // scheduledStartAt
  se?: number | null; // scheduledEndAt
  recurring?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
}

/** Builds a full Task object (matching src/core/types) from a terse override shape. */
export function mkTask(o: SeedTaskOverrides, now = Date.now()) {
  return {
    id: o.id,
    title: o.title,
    description: o.description ?? '',
    createdAt: now - DAY * 3,
    updatedAt: now - DAY,
    deadline: o.deadline ?? null,
    scheduledStartAt: o.ss ?? null,
    scheduledEndAt: o.se ?? null,
    completedAt: o.completedAt ?? null,
    priority: o.priority ?? 'none',
    energyLevel: o.energy ?? 'medium',
    isCompleted: !!o.completedAt,
    isRecurring: !!o.recurring,
    recurringFrequency: o.recurring ?? null,
    deferCount: o.deferCount ?? 0,
    createdHour: 9,
    overdueStartDate: null,
    revivedAt: null,
    archivedAt: null,
    isArchived: false,
    estimatedMinutes: o.est ?? null,
    actualMinutes: o.act ?? null,
    startedAt: o.startedAt ?? null,
    parentId: o.parentId ?? null,
    childIds: o.childIds ?? [],
    depth: o.depth ?? 0,
    category: o.category ?? 'work',
    userId: 'test-user',
  };
}

export function mkInbox(id: string, rawText: string, now = Date.now()) {
  return { id, rawText, capturedAt: now };
}

/**
 * Seed localStorage with the DEV auth bypass + task/inbox/category fixtures,
 * then (re)load so the app boots authed with this data already in place.
 */
export async function seedApp(
  page: Page,
  opts: { tasks?: unknown[]; archived?: unknown[]; inbox?: unknown[]; path?: string } = {},
) {
  await page.goto('/');
  await page.evaluate(
    ({ tasks, archived, inbox }) => {
      localStorage.setItem('__todyDevAuth', '1');
      if (tasks) localStorage.setItem('@tody_tasks', JSON.stringify(tasks));
      if (archived) localStorage.setItem('@tody_archived_tasks', JSON.stringify(archived));
      if (inbox) localStorage.setItem('@tody_inbox_tasks', JSON.stringify(inbox));
    },
    { tasks: opts.tasks ?? [], archived: opts.archived ?? [], inbox: opts.inbox ?? [] },
  );
  await page.goto(opts.path ?? '/', { waitUntil: 'networkidle' });
}

/** Stub every Supabase + FastAPI backend request so tests never touch the real network. */
export async function stubNetwork(page: Page) {
  // PostgREST (Supabase's REST layer) returns a JSON array for table selects —
  // supabaseSync.ts's fetch* helpers call `.map()` on the response, so an
  // empty array (not `{}`) is required here once a real session is seeded
  // (seedSession) and the TaskContext/InboxContext sync effects actually fire.
  // route.fulfill() doesn't add CORS headers on its own — since the app runs
  // on localhost and these hosts are genuinely cross-origin, a fulfilled
  // response without Access-Control-Allow-Origin is rejected by the browser
  // itself (net::ERR_FAILED), even though our stub "answered" the request.
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  await page.route(/supabase\.co/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: cors }),
  );
  await page.route(/tody-backend\.onrender\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: cors }),
  );
}

/**
 * Seed a fake (but structurally real) Supabase session directly into the
 * AsyncStorage-backed localStorage key supabase-js reads on init, so
 * `useAuth().user` is populated without any network round-trip. Uses the
 * project-ref-derived storage key (SUPABASE_AUTH_KEY) so it tracks env.ts.
 */
export async function seedSession(page: Page, email: string, userId = 'test-user') {
  await page.goto('/');
  await page.evaluate(
    ({ email, userId, authKey }) => {
      const nowSec = Math.floor(Date.now() / 1000);
      const session = {
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: nowSec + 3600,
        user: {
          id: userId,
          email,
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      };
      localStorage.setItem(authKey, JSON.stringify(session));
    },
    { email, userId, authKey: SUPABASE_AUTH_KEY },
  );
}

/** Attach console-error / pageerror collectors; call `expectNoErrors()` at the end of a test. */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}
