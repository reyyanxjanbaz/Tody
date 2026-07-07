import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updatePatternsOnCompletion, getEstimateSuggestion, syncPatternsFromCloud } from '../../src/core/utils/patternLearning';
import { api } from '../../src/core/lib/api';
import type { Task } from '../../src/core/types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't', title: 'Task', description: '',
    createdAt: 0, updatedAt: 0, deadline: null, completedAt: null,
    priority: 'none', energyLevel: 'medium', isCompleted: true, isRecurring: false,
    recurringFrequency: null, deferCount: 0, createdHour: 9, overdueStartDate: null,
    revivedAt: null, archivedAt: null, isArchived: false, estimatedMinutes: null,
    actualMinutes: null, startedAt: null, parentId: null, childIds: [], depth: 0,
    category: 'personal',
    ...overrides,
  } as Task;
}

describe('Phase 1.9 — patternLearning', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.post).mockResolvedValue({ data: null, error: null, isBackendDown: false });
    vi.mocked(api.get).mockResolvedValue({ data: null, error: null, isBackendDown: false });
  });

  it('does nothing for a task with no meaningful keywords or no actual time recorded', async () => {
    await updatePatternsOnCompletion(makeTask({ id: 'a', title: 'the a', actualMinutes: 30 }), []);
    await updatePatternsOnCompletion(makeTask({ id: 'b', title: 'wash car', actualMinutes: 0 }), []);
    expect(localStorage.getItem('@tody_task_patterns')).toBeNull();
  });

  it('creates a new pattern once 3 similar completed tasks exist (2 similar + the one just completed)', async () => {
    // Keyword similarity is Jaccard over the *filtered* keyword sets, so these
    // titles must reduce to the same {water, plants} keyword set (stop words
    // like "the"/"my" are dropped) to clear the 0.7 similarity threshold.
    const similar = [
      makeTask({ id: '1', title: 'water the plants', actualMinutes: 10 }),
      makeTask({ id: '2', title: 'water my plants', actualMinutes: 20 }),
    ];
    const completed = makeTask({ id: '3', title: 'water plants', actualMinutes: 15, estimatedMinutes: 15 });

    await updatePatternsOnCompletion(completed, similar);

    const stored = JSON.parse(localStorage.getItem('@tody_task_patterns')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].sampleSize).toBe(3);
    expect(stored[0].averageActualMinutes).toBe(15); // (10+20+15)/3
  });

  it('does not create a pattern with fewer than 2 similar prior tasks (saves an empty pattern list)', async () => {
    const oneSimilar = [makeTask({ id: '1', title: 'water the plants', actualMinutes: 10 })];
    await updatePatternsOnCompletion(makeTask({ id: '2', title: 'water plants', actualMinutes: 15 }), oneSimilar);
    // updatePatternsOnCompletion unconditionally persists after every completion,
    // so storage exists but holds no patterns rather than being untouched.
    expect(JSON.parse(localStorage.getItem('@tody_task_patterns')!)).toEqual([]);
  });

  it('updates an existing pattern\'s running average instead of creating a duplicate', async () => {
    // seed an existing pattern directly in storage
    localStorage.setItem('@tody_task_patterns', JSON.stringify([
      { keywords: ['water', 'plants'], averageActualMinutes: 10, sampleSize: 2, accuracyScore: 80 },
    ]));

    await updatePatternsOnCompletion(makeTask({ id: 'x', title: 'water plants', actualMinutes: 16 }), []);

    const stored = JSON.parse(localStorage.getItem('@tody_task_patterns')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].sampleSize).toBe(3);
    expect(stored[0].averageActualMinutes).toBe(Math.round((10 * 2 + 16) / 3));
  });

  it('getEstimateSuggestion returns null until a matching pattern has sampleSize >= 5', async () => {
    localStorage.setItem('@tody_task_patterns', JSON.stringify([
      { keywords: ['water', 'plants'], averageActualMinutes: 12, sampleSize: 4, accuracyScore: 80 },
    ]));
    expect(await getEstimateSuggestion('water plants')).toBeNull();

    localStorage.setItem('@tody_task_patterns', JSON.stringify([
      { keywords: ['water', 'plants'], averageActualMinutes: 12, sampleSize: 5, accuracyScore: 80 },
    ]));
    expect(await getEstimateSuggestion('water plants')).toEqual({ avgMinutes: 12, sampleSize: 5 });
  });

  it('getEstimateSuggestion returns null for a title with no meaningful keywords', async () => {
    expect(await getEstimateSuggestion('the a an')).toBeNull();
  });

  it('syncPatternsFromCloud overwrites local storage with the API response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [{ keywords: ['gym'], average_actual_minutes: 60, sample_size: 8, accuracy_score: 90 }],
      error: null, isBackendDown: false,
    });
    await syncPatternsFromCloud();
    const stored = JSON.parse(localStorage.getItem('@tody_task_patterns')!);
    expect(stored).toEqual([{ keywords: ['gym'], averageActualMinutes: 60, sampleSize: 8, accuracyScore: 90 }]);
  });

  it('P1.13 — bounds the pattern store at MAX_PATTERNS, keeping the highest-sample ones', async () => {
    // Seed 201 distinct patterns with ascending sample sizes.
    const many = Array.from({ length: 201 }, (_, i) => ({
      keywords: [`kw${i}`], averageActualMinutes: 10, sampleSize: i + 1, accuracyScore: 50,
    }));
    localStorage.setItem('@tody_task_patterns', JSON.stringify(many));
    // A completion touching a brand-new keyword forces a save (bounding).
    await updatePatternsOnCompletion(
      makeTask({ id: 'z', title: 'brandnewuniquekeyword alpha beta', actualMinutes: 12 }),
      [
        makeTask({ id: 's1', title: 'brandnewuniquekeyword alpha beta', actualMinutes: 10 }),
        makeTask({ id: 's2', title: 'brandnewuniquekeyword alpha beta', actualMinutes: 14 }),
      ],
    );
    const stored = JSON.parse(localStorage.getItem('@tody_task_patterns')!);
    expect(stored.length).toBeLessThanOrEqual(200);
    // The weakest (sampleSize 1) pattern should have been dropped.
    expect(stored.some((p: any) => p.sampleSize === 1)).toBe(false);
  });
});
