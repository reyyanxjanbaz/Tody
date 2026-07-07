import { describe, expect, it } from 'vitest';
import { calculateUserStats, getRecentEstimatedTasks, hasEnoughDataForStats } from '../../src/core/utils/statsCalculation';
import type { Task } from '../../src/core/types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't', title: 'Task', description: '',
    createdAt: 0, updatedAt: 0, deadline: null, completedAt: null,
    priority: 'none', energyLevel: 'medium', isCompleted: false, isRecurring: false,
    recurringFrequency: null, deferCount: 0, createdHour: 9, overdueStartDate: null,
    revivedAt: null, archivedAt: null, isArchived: false, estimatedMinutes: null,
    actualMinutes: null, startedAt: null, parentId: null, childIds: [], depth: 0,
    category: 'personal',
    ...overrides,
  } as Task;
}

function completedWith(id: string, est: number, act: number, completedAt = 0): Task {
  return makeTask({ id, isCompleted: true, estimatedMinutes: est, actualMinutes: act, completedAt });
}

describe('Phase 1.9 — statsCalculation', () => {
  it('calculateUserStats returns all zeros when there is no qualifying data', () => {
    expect(calculateUserStats([])).toEqual({
      totalCompletedTasks: 0, totalEstimatedMinutes: 0, totalActualMinutes: 0,
      realityScore: 0, underestimationRate: 0,
    });
  });

  it('calculateUserStats gives a perfect realityScore (100) for spot-on estimates', () => {
    const stats = calculateUserStats([completedWith('a', 60, 60)]);
    expect(stats.totalCompletedTasks).toBe(1);
    expect(stats.realityScore).toBe(100);
    expect(stats.underestimationRate).toBe(0);
  });

  it('calculateUserStats: positive underestimationRate when actual > estimated', () => {
    const stats = calculateUserStats([completedWith('a', 30, 60)]);
    expect(stats.underestimationRate).toBe(100); // took 2x as long
    // Canonical formula uses the ESTIMATED denominator: |30-60|/30 = 100% off → 0.
    expect(stats.realityScore).toBe(0);
  });

  it('calculateUserStats: negative underestimationRate when actual < estimated (overestimated)', () => {
    const stats = calculateUserStats([completedWith('a', 60, 30)]);
    expect(stats.underestimationRate).toBe(-50);
    // |60-30|/60 = 50% off → 50.
    expect(stats.realityScore).toBe(50);
  });

  it('calculateUserStats ignores tasks missing an estimate, an actual, or not completed', () => {
    const noEstimate = makeTask({ isCompleted: true, actualMinutes: 30 });
    const noActual = makeTask({ isCompleted: true, estimatedMinutes: 30 });
    const notCompleted = makeTask({ estimatedMinutes: 30, actualMinutes: 30 });
    expect(calculateUserStats([noEstimate, noActual, notCompleted]).totalCompletedTasks).toBe(0);
  });

  it('getRecentEstimatedTasks sorts newest-completed-first and caps at `count`', () => {
    const tasks = [
      completedWith('old', 10, 10, 100),
      completedWith('new', 10, 10, 300),
      completedWith('mid', 10, 10, 200),
    ];
    expect(getRecentEstimatedTasks(tasks, 2).map(t => t.id)).toEqual(['new', 'mid']);
  });

  it('hasEnoughDataForStats requires at least 10 qualifying completed tasks', () => {
    const nine = Array.from({ length: 9 }, (_, i) => completedWith(`t${i}`, 10, 10));
    const ten = Array.from({ length: 10 }, (_, i) => completedWith(`t${i}`, 10, 10));
    expect(hasEnoughDataForStats(nine)).toBe(false);
    expect(hasEnoughDataForStats(ten)).toBe(true);
  });
});
