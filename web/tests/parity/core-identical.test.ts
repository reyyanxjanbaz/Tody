import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Phase 1 parity gate: every file copied verbatim from the native app into
 * web/src/core must remain byte-identical to its native source. If this test
 * goes red, someone edited a "verbatim" file in one tree without the other —
 * exactly the silent-drift class of bug this suite exists to catch.
 *
 * The 4 *intentionally* edited files (RN API removed) are excluded here and
 * covered by targeted behavioral tests instead:
 *   - core/utils/colors.ts        (StyleSheet/Platform -> plain tokens)
 *   - core/context/ThemeContext.tsx (StatusBar -> DOM/meta)
 *   - core/context/TaskContext.tsx  (LayoutAnimation -> beginLayoutAnimation)
 *   - core/context/InboxContext.tsx (RN Alert -> web Alert)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '../..');
const NATIVE_ROOT = path.resolve(WEB_ROOT, '..');

// Files intentionally diverged from native. Each MUST have a documented reason
// and behavioral test coverage. Original 4 = RN-API removal for the web port.
// Overhaul additions (see plan crispy-launching-sketch.md) fix logic defects.
const EDITED_ALLOWLIST_WITH_REASONS: Record<string, string> = {
  'utils/colors.ts': 'RN StyleSheet/Platform → plain tokens',
  'context/ThemeContext.tsx': 'RN StatusBar → DOM/meta',
  'context/TaskContext.tsx': 'RN LayoutAnimation → web; + overhaul: defer/tombstones/focus-sync/recurrence/order; Phase D mergeRemoteTasks + echo guard',
  'context/InboxContext.tsx': 'RN Alert → web; + overhaul: tombstones/focus-sync; Phase B workspace capture',
  'utils/decay.ts': 'P1.3 startOfDay-normalized isFullyDecayed; removed dead MIN_OPACITY',
  'utils/statsCalculation.ts': 'P1.5 canonical reality-score formula (estimated denominator, default 0)',
  'utils/profileStats.ts': 'P1.6 monotonic history-derived XP + extraXP; P1.12 single-day calendar count',
  'utils/patternLearning.ts': 'P1.13 bounded pattern store (MAX_PATTERNS), removed dead age constant',
  'lib/supabaseSync.ts': 'P1.10 soft-delete + filter tombstoned rows; P1.14 persisted category UUID map; Phase B workspace_id row mapping',
};
const EDITED_ALLOWLIST = new Set(Object.keys(EDITED_ALLOWLIST_WITH_REASONS));

// Pure-logic files that were copied byte-for-byte (native path relative to src/, web path relative to core/).
const VERBATIM_FILES = [
  'utils/taskParser.ts',
  'utils/taskIntelligence.ts',
  'utils/dateUtils.ts',
  'utils/dependencyChains.ts',
  'utils/timeTracking.ts',
  'utils/calendarDayboard.ts',
  'utils/id.ts',
  'utils/haptics.ts',
  'utils/storage.ts',
  'utils/swipeMemory.ts',
  'lib/api.ts',
  'lib/supabase.ts',
  'lib/env.ts',
  'types/index.ts',
  'context/AuthContext.tsx',
];

describe('Phase 1 parity — core logic layer is byte-identical to native', () => {
  it.each(VERBATIM_FILES)('%s is untouched', (rel) => {
    expect(EDITED_ALLOWLIST.has(rel)).toBe(false); // sanity: verbatim list and allowlist must not overlap

    const nativePath = path.join(NATIVE_ROOT, 'src', rel);
    const webPath = path.join(WEB_ROOT, 'src', 'core', rel);

    expect(existsSync(nativePath), `native file missing: ${nativePath}`).toBe(true);
    expect(existsSync(webPath), `web file missing: ${webPath}`).toBe(true);

    const native = readFileSync(nativePath, 'utf8');
    const web = readFileSync(webPath, 'utf8');
    expect(web).toBe(native);
  });

  it('the edited-file allowlist matches exactly the known intentional edits', () => {
    expect([...EDITED_ALLOWLIST].sort()).toEqual(
      [
        'utils/colors.ts',
        'context/ThemeContext.tsx',
        'context/TaskContext.tsx',
        'context/InboxContext.tsx',
        'utils/decay.ts',
        'utils/statsCalculation.ts',
        'utils/profileStats.ts',
        'utils/patternLearning.ts',
        'lib/supabaseSync.ts',
      ].sort(),
    );
  });

  it('edited files still exist on both sides (edits tracked, not deletions)', () => {
    for (const rel of EDITED_ALLOWLIST) {
      const nativePath = path.join(NATIVE_ROOT, 'src', rel);
      const webPath = path.join(WEB_ROOT, 'src', 'core', rel);
      expect(existsSync(nativePath), `native file missing: ${nativePath}`).toBe(true);
      expect(existsSync(webPath), `web file missing: ${webPath}`).toBe(true);
    }
  });
});
