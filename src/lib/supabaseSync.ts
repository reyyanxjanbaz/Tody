/**
 * Supabase Sync Service
 *
 * Bridges the gap between local AsyncStorage state and the Supabase database.
 * This is the module that was MISSING — without it, the app stored everything
 * locally and the database tables stayed empty.
 *
 * Architecture:
 *   • Uses the Supabase JS client directly (with the user's session JWT),
 *     so RLS policies are enforced automatically.
 *   • Provides push/pull helpers for tasks, categories, and inbox.
 *   • Handles the data-model mismatch between frontend (camelCase, epoch-ms
 *     timestamps, string category IDs) and database (snake_case, ISO
 *     timestamps, UUID category foreign keys).
 */

import { supabase } from './supabase';
import { Task, Category, InboxTask } from '../types';

// ── Logging helper ──────────────────────────────────────────────────────────

const LOG_PREFIX = '[SupabaseSync]';
function log(...args: any[]) {
  if (__DEV__) {
    console.log(LOG_PREFIX, ...args);
  }
}
function logError(...args: any[]) {
  console.error(LOG_PREFIX, ...args);
}

/** Check whether a string is a valid UUID v4 */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ── Timestamp helpers ───────────────────────────────────────────────────────

/** epoch ms → ISO string  (null-safe) */
function toISO(epoch: number | null | undefined): string | null {
  if (epoch == null) return null;
  return new Date(epoch).toISOString();
}

/** ISO string → epoch ms  (null-safe) */
function fromISO(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  return isNaN(ts) ? null : ts;
}

// ── Category mapping ────────────────────────────────────────────────────────
// The frontend uses fixed string IDs ('work', 'personal', 'health', 'overview')
// while the DB uses UUID primary keys with a name field.
// We build a bidirectional map at sync time.

export interface CategoryMap {
  /** local string id → supabase uuid */
  toUUID: Record<string, string>;
  /** supabase uuid → local string id */
  toLocal: Record<string, string>;
}

/**
 * Build a mapping between local category IDs and Supabase UUIDs
 * by matching on the category name (case-insensitive).
 */
export function buildCategoryMap(
  localCategories: Category[],
  dbCategories: DbCategory[],
): CategoryMap {
  const toUUID: Record<string, string> = {};
  const toLocal: Record<string, string> = {};

  for (const local of localCategories) {
    const match = dbCategories.find(
      db => db.name.toLowerCase() === local.name.toLowerCase(),
    );
    if (match) {
      toUUID[local.id] = match.id;
      toLocal[match.id] = local.id;
    }
  }

  return { toUUID, toLocal };
}

// ── DB row types ────────────────────────────────────────────────────────────

interface DbTask {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string;
  priority: string;
  energy_level: string;
  is_completed: boolean;
  completed_at: string | null;
  deadline: string | null;
  is_recurring: boolean;
  recurring_frequency: string | null;
  defer_count: number;
  created_hour: number;
  overdue_start_date: string | null;
  revived_at: string | null;
  archived_at: string | null;
  is_archived: boolean;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  started_at: string | null;
  parent_id: string | null;
  depth: number;
  created_at: string;
  updated_at: string;
}

interface DbCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface DbInboxTask {
  id: string;
  user_id: string;
  raw_text: string;
  captured_at: string;
}

// ── Transform: Local → DB ───────────────────────────────────────────────────

export function taskToDbRow(task: Task, userId: string, catMap: CategoryMap): Partial<DbTask> {
  const row: Record<string, any> = {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description || '',
    priority: task.priority || 'none',
    energy_level: task.energyLevel || 'medium',
    is_completed: task.isCompleted ?? false,
    completed_at: toISO(task.completedAt),
    deadline: toISO(task.deadline),
    is_recurring: task.isRecurring ?? false,
    recurring_frequency: task.recurringFrequency || null,
    defer_count: task.deferCount ?? 0,
    created_hour: task.createdHour ?? new Date().getHours(),
    overdue_start_date: toISO(task.overdueStartDate),
    revived_at: toISO(task.revivedAt),
    archived_at: toISO(task.archivedAt),
    is_archived: task.isArchived ?? false,
    estimated_minutes: task.estimatedMinutes || null,
    actual_minutes: task.actualMinutes || null,
    started_at: toISO(task.startedAt),
    parent_id: task.parentId || null,
    depth: task.depth ?? 0,
    created_at: toISO(task.createdAt) || new Date().toISOString(),
    updated_at: toISO(task.updatedAt) || new Date().toISOString(),
  };

  // Map local category string to UUID
  if (task.category && catMap.toUUID[task.category]) {
    row.category_id = catMap.toUUID[task.category];
  } else {
    row.category_id = null;
  }

  return row;
}

// ── Transform: DB → Local ───────────────────────────────────────────────────

export function dbRowToTask(row: DbTask, catMap: CategoryMap): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    createdAt: fromISO(row.created_at) ?? Date.now(),
    updatedAt: fromISO(row.updated_at) ?? Date.now(),
    deadline: fromISO(row.deadline),
    completedAt: fromISO(row.completed_at),
    priority: (row.priority as Task['priority']) || 'none',
    energyLevel: (row.energy_level as Task['energyLevel']) || 'medium',
    isCompleted: row.is_completed ?? false,
    isRecurring: row.is_recurring ?? false,
    recurringFrequency: row.recurring_frequency as Task['recurringFrequency'] || null,
    deferCount: row.defer_count ?? 0,
    createdHour: row.created_hour ?? 0,
    overdueStartDate: fromISO(row.overdue_start_date),
    revivedAt: fromISO(row.revived_at),
    archivedAt: fromISO(row.archived_at),
    isArchived: row.is_archived ?? false,
    estimatedMinutes: row.estimated_minutes,
    actualMinutes: row.actual_minutes,
    startedAt: fromISO(row.started_at),
    parentId: row.parent_id || null,
    childIds: [], // Will be rebuilt from parent_id relationships
    depth: row.depth ?? 0,
    category: row.category_id ? (catMap.toLocal[row.category_id] || undefined) : undefined,
    userId: row.user_id,
  };
}

function dbRowToCategory(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default,
    order: row.sort_order,
  };
}

function dbRowToInboxTask(row: DbInboxTask): InboxTask {
  return {
    id: row.id,
    rawText: row.raw_text,
    capturedAt: fromISO(row.captured_at) ?? Date.now(),
  };
}

// ── Rebuild childIds from parentId references ───────────────────────────────

export function rebuildChildIds(tasks: Task[]): Task[] {
  const childMap = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.parentId) {
      const existing = childMap.get(t.parentId) || [];
      existing.push(t.id);
      childMap.set(t.parentId, existing);
    }
  }
  return tasks.map(t => ({
    ...t,
    childIds: childMap.get(t.id) || [],
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API — these are the functions contexts will call
// ═══════════════════════════════════════════════════════════════════════════

// ── Categories ──────────────────────────────────────────────────────────────

/** Fetch all categories from Supabase for the current user. */
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');

  if (error) {
    logError('fetchCategories failed:', error.message);
    return [];
  }
  return (data || []).map(dbRowToCategory);
}

/** Push a single category to Supabase (upsert). */
export async function upsertCategory(cat: Category, userId: string): Promise<void> {
  // Default categories use string IDs (e.g. 'overview', 'work') which are not
  // valid UUIDs. They are already seeded by the DB trigger, so skip them.
  if (!isValidUUID(cat.id)) {
    log(`Skipping upsertCategory for non-UUID id: ${cat.id}`);
    return;
  }
  const row = {
    id: cat.id,
    user_id: userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    is_default: cat.isDefault,
    sort_order: cat.order,
  };
  const { error } = await supabase
    .from('categories')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    logError('upsertCategory failed:', error.message);
  }
}

/** Push all local categories to Supabase. */
export async function pushCategories(categories: Category[], userId: string): Promise<void> {
  if (categories.length === 0) return;

  // Filter out default categories with non-UUID IDs (e.g. 'overview', 'work').
  // These are already seeded by the DB trigger on user signup.
  const pushable = categories.filter(c => isValidUUID(c.id));
  if (pushable.length === 0) {
    log('No user-created categories to push (defaults seeded by DB)');
    return;
  }

  const rows = pushable.map(c => ({
    id: c.id,
    user_id: userId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    is_default: c.isDefault,
    sort_order: c.order,
  }));
  const { error } = await supabase
    .from('categories')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    logError('pushCategories failed:', error.message);
  } else {
    log(`Pushed ${rows.length} categories`);
  }
}

// ── Tasks ───────────────────────────────────────────────────────────────────

/** Fetch all tasks from Supabase. Returns them with childIds rebuilt. */
export async function fetchTasks(catMap: CategoryMap): Promise<{ active: Task[]; archived: Task[] }> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logError('fetchTasks failed:', error.message);
    return { active: [], archived: [] };
  }

  const all = (data || []).map((row: DbTask) => dbRowToTask(row, catMap));
  const withChildren = rebuildChildIds(all);

  const active = withChildren.filter(t => !t.isArchived);
  const archived = withChildren.filter(t => t.isArchived);

  log(`Fetched ${active.length} active + ${archived.length} archived tasks`);
  return { active, archived };
}

/** Push all local tasks to Supabase (upsert). */
export async function pushTasks(
  tasks: Task[],
  userId: string,
  catMap: CategoryMap,
): Promise<void> {
  if (tasks.length === 0) return;

  const rows = tasks.map(t => taskToDbRow(t, userId, catMap));

  // Supabase has a limit on upsert size; chunk into 200
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('tasks')
      .upsert(chunk as any, { onConflict: 'id' });

    if (error) {
      logError(`pushTasks chunk ${i}-${i + chunk.length} failed:`, error.message);
    }
  }

  log(`Pushed ${rows.length} tasks`);
}

/** Push a single task to Supabase (upsert). Fire-and-forget. */
export async function upsertTask(task: Task, userId: string, catMap: CategoryMap): Promise<void> {
  const row = taskToDbRow(task, userId, catMap);
  const { error } = await supabase
    .from('tasks')
    .upsert(row as any, { onConflict: 'id' });

  if (error) {
    logError('upsertTask failed:', error.message);
  }
}

/** Delete a task from Supabase. */
export async function deleteTaskFromDb(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    logError('deleteTaskFromDb failed:', error.message);
  }
}

/** Delete multiple tasks from Supabase. */
export async function deleteTasksFromDb(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const { error } = await supabase
    .from('tasks')
    .delete()
    .in('id', taskIds);

  if (error) {
    logError('deleteTasksFromDb failed:', error.message);
  }
}

// ── Inbox ───────────────────────────────────────────────────────────────────

/** Fetch all inbox tasks from Supabase. */
export async function fetchInboxTasks(): Promise<InboxTask[]> {
  const { data, error } = await supabase
    .from('inbox_tasks')
    .select('*')
    .order('captured_at', { ascending: false });

  if (error) {
    logError('fetchInboxTasks failed:', error.message);
    return [];
  }
  return (data || []).map(dbRowToInboxTask);
}

/** Push all local inbox tasks to Supabase (insert, skip duplicates). */
export async function pushInboxTasks(tasks: InboxTask[], userId: string): Promise<void> {
  if (tasks.length === 0) return;
  const rows = tasks.map(t => ({
    id: t.id,
    user_id: userId,
    raw_text: t.rawText,
    captured_at: toISO(t.capturedAt) || new Date().toISOString(),
  }));

  // Use ignoreDuplicates so if a row with the same ID already exists
  // (possibly from another account), it is skipped instead of triggering
  // an UPDATE that would fail the RLS USING check.
  const { error } = await supabase
    .from('inbox_tasks')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    logError('pushInboxTasks failed:', error.message);
  } else {
    log(`Pushed ${rows.length} inbox tasks`);
  }
}

/** Upsert a single inbox task. */
export async function upsertInboxTask(task: InboxTask, userId: string): Promise<void> {
  const row = {
    id: task.id,
    user_id: userId,
    raw_text: task.rawText,
    captured_at: toISO(task.capturedAt) || new Date().toISOString(),
  };
  const { error } = await supabase
    .from('inbox_tasks')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    logError('upsertInboxTask failed:', error.message);
  }
}

/** Delete an inbox task from Supabase. */
export async function deleteInboxTaskFromDb(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('inbox_tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    logError('deleteInboxTaskFromDb failed:', error.message);
  }
}

// ── Full Sync ───────────────────────────────────────────────────────────────

/**
 * Full sync: push all local data to Supabase.
 * Call this once when the user first logs in or when you want to ensure
 * all local data is persisted to the cloud.
 */
export async function fullSync(
  tasks: Task[],
  archivedTasks: Task[],
  categories: Category[],
  inboxTasks: InboxTask[],
  userId: string,
): Promise<void> {
  log('Starting full sync...');

  try {
    // 1. First push categories so we have valid UUIDs
    await pushCategories(categories, userId);

    // 2. Fetch DB categories to build the mapping
    const dbCats = await fetchCategories();
    const catMap = buildCategoryMap(categories, dbCats as any);

    // 3. Push all tasks (active + archived)
    const allTasks = [...tasks, ...archivedTasks];
    await pushTasks(allTasks, userId, catMap);

    // 4. Push inbox tasks
    await pushInboxTasks(inboxTasks, userId);

    log('Full sync complete!');
  } catch (e) {
    logError('Full sync failed:', e);
  }
}
