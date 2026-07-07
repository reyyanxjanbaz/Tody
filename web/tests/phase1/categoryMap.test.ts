import { describe, expect, it } from 'vitest';
import { buildCategoryMap, type CategoryMap } from '../../src/core/lib/supabaseSync';
import type { Category } from '../../src/core/types';

const cat = (id: string, name: string): Category =>
  ({ id, name, icon: 'folder-outline', color: '#000', isDefault: false, order: 0 });

const dbCat = (id: string, name: string) =>
  ({ id, user_id: 'u', name, icon: 'folder-outline', color: '#000', is_default: false, sort_order: 0, created_at: '', updated_at: '' });

describe('Phase 1.14 — buildCategoryMap persistence (rename-safe)', () => {
  it('bootstraps by name when there is no prior map', () => {
    const map = buildCategoryMap([cat('work', 'Work')], [dbCat('uuid-1', 'Work')]);
    expect(map.toUUID['work']).toBe('uuid-1');
    expect(map.toLocal['uuid-1']).toBe('work');
  });

  it('keeps a category bound to its UUID after a rename via the prior map', () => {
    // First sync: "Work" ↔ uuid-1.
    const prior: CategoryMap = buildCategoryMap([cat('work', 'Work')], [dbCat('uuid-1', 'Work')]);

    // User renamed the local category to "Job" (same id 'work'); the DB row is
    // still named "Work". Name matching alone would fail → category lost.
    const renamed = buildCategoryMap([cat('work', 'Job')], [dbCat('uuid-1', 'Work')], prior);
    expect(renamed.toUUID['work']).toBe('uuid-1'); // preserved via prior id→uuid
  });

  it('falls back to name matching if the prior UUID no longer exists in the DB', () => {
    const prior: CategoryMap = { toUUID: { work: 'gone-uuid' }, toLocal: { 'gone-uuid': 'work' } };
    const map = buildCategoryMap([cat('work', 'Work')], [dbCat('uuid-2', 'Work')], prior);
    expect(map.toUUID['work']).toBe('uuid-2');
  });
});
