/**
 * Time Block Integrity System - Stats Calculation
 * Calculate user estimation accuracy and related statistics.
 */
import { Task, UserStats } from '../types';

/**
 * Calculate user stats from completed tasks that have both estimates and actuals.
 */
export function calculateUserStats(tasks: Task[]): UserStats {
  const completedWithEstimates = tasks.filter(
    t => t.isCompleted &&
         t.estimatedMinutes != null &&
         t.estimatedMinutes > 0 &&
         t.actualMinutes != null &&
         t.actualMinutes >= 1,
  );

  const totalCompletedTasks = completedWithEstimates.length;

  if (totalCompletedTasks === 0) {
    return {
      totalCompletedTasks: 0,
      totalEstimatedMinutes: 0,
      totalActualMinutes: 0,
      realityScore: 0,
      underestimationRate: 0,
    };
  }

  const totalEstimatedMinutes = completedWithEstimates.reduce(
    (sum, t) => sum + (t.estimatedMinutes || 0), 0,
  );
  const totalActualMinutes = completedWithEstimates.reduce(
    (sum, t) => sum + (t.actualMinutes || 0), 0,
  );

  // Reality Score: how accurate estimates are overall
  // 100 = perfect accuracy, 0 = completely off
  const realityScore = totalActualMinutes > 0
    ? Math.max(0, Math.round(100 - (Math.abs(totalEstimatedMinutes - totalActualMinutes) / totalActualMinutes * 100)))
    : 0;

  // Underestimation Rate: positive means user underestimates
  const underestimationRate = totalEstimatedMinutes > 0
    ? Math.round((totalActualMinutes - totalEstimatedMinutes) / totalEstimatedMinutes * 100)
    : 0;

  return {
    totalCompletedTasks,
    totalEstimatedMinutes,
    totalActualMinutes,
    realityScore,
    underestimationRate,
  };
}

/**
 * Get the last N completed tasks with both estimates and actuals,
 * ordered by completion date (newest first).
 */
export function getRecentEstimatedTasks(tasks: Task[], count: number = 10): Task[] {
  return tasks
    .filter(
      t => t.isCompleted &&
           t.estimatedMinutes != null &&
           t.estimatedMinutes > 0 &&
           t.actualMinutes != null &&
           t.actualMinutes >= 1 &&
           t.completedAt != null,
    )
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, count);
}

/**
 * Check if user has enough data to show the Reality Score dashboard.
 * Requires at least 10 completed tasks with estimates.
 */
export function hasEnoughDataForStats(tasks: Task[]): boolean {
  const count = tasks.filter(
    t => t.isCompleted &&
         t.estimatedMinutes != null &&
         t.estimatedMinutes > 0 &&
         t.actualMinutes != null &&
         t.actualMinutes >= 1,
  ).length;
  return count >= 10;
}
