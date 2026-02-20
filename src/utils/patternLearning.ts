/**
 * Time Block Integrity System – Pattern Learning
 * Learn patterns from completed tasks to provide reality-based estimates.
 * Patterns are stored locally (KEYS.TASK_PATTERNS) and synced to the cloud
 * via POST /patterns/sync after every update.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, TaskPattern } from '../types';
import { KEYS } from './storage';
import { api } from '../lib/api';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PATTERN_MAX_AGE_DAYS = 90;

// Stop words to filter from task titles
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up',
  'about', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'out', 'off', 'over', 'under', 'again',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
  'some', 'such', 'no', 'only', 'own', 'same',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself',
  'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
  'get', 'make', 'go', 'take', 'come', 'see', 'know', 'just',
  'also', 'very', 'really', 'too', 'quite',
]);

/**
 * Extract meaningful keywords from a task title.
 */
function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Calculate keyword similarity between two sets of keywords.
 * Returns a score from 0 to 1.
 */
function keywordSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) { return 0; }
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

// ── Cloud sync helpers ────────────────────────────────────────────────────────

/** Pull patterns from the cloud and overwrite local storage (best-effort). */
export async function syncPatternsFromCloud(): Promise<void> {
  try {
    const { data } = await api.get<Array<{
      keywords: string[];
      average_actual_minutes: number;
      sample_size: number;
      accuracy_score: number;
    }>>('/patterns');
    if (!data || data.length === 0) return;
    const mapped: TaskPattern[] = data.map(p => ({
      keywords:             p.keywords,
      averageActualMinutes: p.average_actual_minutes,
      sampleSize:           p.sample_size,
      accuracyScore:        p.accuracy_score,
    }));
    await AsyncStorage.setItem(KEYS.TASK_PATTERNS, JSON.stringify(mapped));
  } catch { /* best-effort */ }
}

/** Push local patterns to the cloud after every save (best-effort). */
async function pushPatternsToCloud(patterns: TaskPattern[]): Promise<void> {
  try {
    await api.post('/patterns/sync', patterns.map(p => ({
      keywords:               p.keywords,
      average_actual_minutes: p.averageActualMinutes,
      sample_size:            p.sampleSize,
      accuracy_score:         p.accuracyScore,
    })));
  } catch { /* best-effort */ }
}

// ── Local CRUD ────────────────────────────────────────────────────────────────

/**
 * Load task patterns from storage.
 */
async function loadPatterns(): Promise<TaskPattern[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.TASK_PATTERNS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save task patterns to storage and trigger a cloud sync.
 */
async function savePatterns(patterns: TaskPattern[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.TASK_PATTERNS, JSON.stringify(patterns));
  // Fire-and-forget cloud sync after every local save
  pushPatternsToCloud(patterns).catch(() => {});
}

/**
 * Find matching pattern for given keywords.
 * Requires at least 70% similarity.
 */
function findMatchingPattern(
  keywords: string[],
  patterns: TaskPattern[],
): TaskPattern | null {
  let bestMatch: TaskPattern | null = null;
  let bestScore = 0;

  for (const pattern of patterns) {
    const similarity = keywordSimilarity(keywords, pattern.keywords);
    if (similarity >= 0.7 && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = pattern;
    }
  }

  return bestMatch;
}

/**
 * Update patterns when a task is completed.
 * - If matching pattern found: update average and sample size
 * - If no match but enough similar completed tasks: create new pattern
 */
export async function updatePatternsOnCompletion(
  completedTask: Task,
  allCompletedTasksWithActual: Task[],
): Promise<void> {
  if (!completedTask.actualMinutes || completedTask.actualMinutes < 1) { return; }

  const keywords = extractKeywords(completedTask.title);
  if (keywords.length === 0) { return; }

  const patterns = await loadPatterns();
  const matchIdx = patterns.findIndex(
    p => keywordSimilarity(keywords, p.keywords) >= 0.7,
  );

  if (matchIdx >= 0) {
    // Update existing pattern
    const pattern = patterns[matchIdx];
    const totalMinutes = pattern.averageActualMinutes * pattern.sampleSize + completedTask.actualMinutes;
    pattern.sampleSize += 1;
    pattern.averageActualMinutes = Math.round(totalMinutes / pattern.sampleSize);

    // Update accuracy score if task had estimate
    if (completedTask.estimatedMinutes) {
      const accuracy = 100 - Math.abs(
        (completedTask.estimatedMinutes - completedTask.actualMinutes) /
        completedTask.actualMinutes * 100,
      );
      pattern.accuracyScore = Math.round(
        (pattern.accuracyScore * (pattern.sampleSize - 1) + Math.max(0, accuracy)) /
        pattern.sampleSize,
      );
    }

    patterns[matchIdx] = pattern;
  } else {
    // See if there are enough similar completed tasks to create a new pattern
    const similarTasks = allCompletedTasksWithActual.filter(t => {
      if (t.id === completedTask.id || !t.actualMinutes || t.actualMinutes < 1) { return false; }
      const tKeywords = extractKeywords(t.title);
      return keywordSimilarity(keywords, tKeywords) >= 0.7;
    });

    // Need at least 2 other similar tasks (3 total including current)
    if (similarTasks.length >= 2) {
      const allSimilar = [...similarTasks, completedTask];
      const avgMinutes = Math.round(
        allSimilar.reduce((sum, t) => sum + (t.actualMinutes || 0), 0) / allSimilar.length,
      );

      // Calculate accuracy from tasks that had estimates
      const tasksWithEstimates = allSimilar.filter(t => t.estimatedMinutes);
      let accuracyScore = 50; // Default
      if (tasksWithEstimates.length > 0) {
        accuracyScore = Math.round(
          tasksWithEstimates.reduce((sum, t) => {
            const acc = 100 - Math.abs(
              ((t.estimatedMinutes || 0) - (t.actualMinutes || 0)) / (t.actualMinutes || 1) * 100,
            );
            return sum + Math.max(0, acc);
          }, 0) / tasksWithEstimates.length,
        );
      }

      patterns.push({
        keywords,
        averageActualMinutes: avgMinutes,
        sampleSize: allSimilar.length,
        accuracyScore,
      });
    }
  }

  await savePatterns(patterns);
}

/**
 * Get estimate suggestion for a task title.
 * Returns null if no matching pattern or not enough data.
 */
export async function getEstimateSuggestion(
  title: string,
): Promise<{ avgMinutes: number; sampleSize: number } | null> {
  const keywords = extractKeywords(title);
  if (keywords.length === 0) { return null; }

  const patterns = await loadPatterns();
  const match = findMatchingPattern(keywords, patterns);

  if (match && match.sampleSize >= 5) {
    return {
      avgMinutes: match.averageActualMinutes,
      sampleSize: match.sampleSize,
    };
  }

  return null;
}
