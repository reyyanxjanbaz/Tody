/**
 * Time Block Integrity System - Timing Utilities
 * Track actual task completion time vs. estimated time.
 */

/**
 * Calculate actual minutes spent on a task.
 * @param startedAt - Timestamp when task was started
 * @param completedAt - Timestamp when task was completed
 * @returns Actual minutes spent, or null if invalid
 */
export function calculateActualMinutes(
  startedAt: number | null | undefined,
  completedAt: number | null | undefined,
): number | null {
  if (!startedAt || !completedAt) { return null; }
  const diff = completedAt - startedAt;
  if (diff < 0) { return null; }
  return Math.round(diff / 60000); // Convert ms to minutes
}

/**
 * Parse user estimate input into minutes.
 * Accepts formats: "30", "30m", "30 min", "1h", "1 hour", "1h30m", "1.5h"
 */
export function parseEstimateInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) { return null; }

  // Pure number = minutes
  const pureNum = Number(trimmed);
  if (!isNaN(pureNum) && pureNum > 0) { return Math.round(pureNum); }

  // "1h30m" or "1h 30m"
  const hhmm = trimmed.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|r)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/);
  if (hhmm) {
    const hours = parseFloat(hhmm[1]);
    const mins = hhmm[2] ? parseInt(hhmm[2], 10) : 0;
    return Math.round(hours * 60 + mins);
  }

  // "30m" or "30 min" or "30 minutes"
  const minMatch = trimmed.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/);
  if (minMatch) { return parseInt(minMatch[1], 10); }

  return null;
}

/**
 * Format minutes into a human-readable string.
 * e.g., 90 => "1h 30m", 30 => "30m", 120 => "2h"
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 1) { return '<1m'; }
  if (minutes < 60) { return `${Math.round(minutes)}m`; }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) { return `${hours}h`; }
  return `${hours}h ${mins}m`;
}

/**
 * Check if actual minutes seem unreasonable (>8 hours continuous).
 */
export function isUnreasonableDuration(minutes: number): boolean {
  return minutes > 480;
}

/**
 * Check if actual minutes are too short to be meaningful (<1 min).
 */
export function isTooShort(minutes: number): boolean {
  return minutes < 1;
}

/**
 * Get the elapsed time since a task was started (for display during tracking).
 */
export function getElapsedMinutes(startedAt: number): number {
  return Math.round((Date.now() - startedAt) / 60000);
}
