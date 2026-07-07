import { ParsedTaskInput, Priority } from '../types';
import { endOfDay, addDays, getNextDay } from './dateUtils';

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const TIME_PATTERN = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
const URGENT_PATTERN = /\b(urgent|asap|critical|immediately)\b/i;
const HIGH_PATTERN = /\b(important|high\s*priority)\b/i;
const LOW_PATTERN = /\b(whenever|eventually|low\s*priority|no\s*rush)\b/i;

const DATE_RULES: Array<{ pattern: RegExp; resolve: () => Date }> = [
  { pattern: /\btoday\b/i, resolve: () => endOfDay() },
  { pattern: /\btomorrow\b/i, resolve: () => endOfDay(addDays(new Date(), 1)) },
  { pattern: /\bnext\s+week\b/i, resolve: () => endOfDay(getNextDay(1)) },
];

const NEXT_DAY_PATTERN =
  /\bnext\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thurs|friday|fri|saturday|sat)\b/i;

/**
 * Parses natural language task input into structured fields.
 *
 * Examples:
 *   "buy groceries tomorrow"       → deadline: tomorrow 23:59, priority: none
 *   "call dentist at 3pm"          → deadline: today 3pm, priority: none
 *   "urgent fix deploy"            → deadline: today 23:59, priority: high
 *   "learn rust whenever"          → deadline: null, priority: low
 *   "meeting next friday at 10am"  → deadline: next friday 10am, priority: none
 */
export function parseTaskInput(input: string): ParsedTaskInput {
  let title = input.trim();
  let deadline: number | null = null;
  let priority: Priority = 'none';

  // --- Extract priority ---
  if (URGENT_PATTERN.test(title)) {
    priority = 'high';
    title = title.replace(URGENT_PATTERN, '').trim();
    deadline = endOfDay().getTime();
  } else if (HIGH_PATTERN.test(title)) {
    priority = 'high';
    title = title.replace(HIGH_PATTERN, '').trim();
  } else if (LOW_PATTERN.test(title)) {
    priority = 'low';
    title = title.replace(LOW_PATTERN, '').trim();
  }

  // --- Extract time (before date, so we can apply it to the resolved date) ---
  let extractedHour: number | null = null;
  let extractedMinute = 0;

  const timeMatch = title.match(TIME_PATTERN);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    extractedMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3]?.toLowerCase();

    if (period === 'pm' && hour < 12) { hour += 12; }
    if (period === 'am' && hour === 12) { hour = 0; }
    if (!period && hour <= 12 && hour >= 1) {
      // Heuristic: bare numbers 1-7 assumed PM, 8-12 assumed AM
      if (hour < 8) { hour += 12; }
    }

    extractedHour = hour;
    title = title.replace(TIME_PATTERN, '').trim();
  }

  // --- Extract date keywords ---
  for (const { pattern, resolve } of DATE_RULES) {
    if (pattern.test(title)) {
      const resolvedDate = resolve();
      if (extractedHour !== null) {
        resolvedDate.setHours(extractedHour, extractedMinute, 0, 0);
      }
      deadline = resolvedDate.getTime();
      title = title.replace(pattern, '').trim();
      break;
    }
  }

  // --- Extract "next <dayname>" ---
  if (!deadline) {
    const nextDayMatch = title.match(NEXT_DAY_PATTERN);
    if (nextDayMatch) {
      const dayName = nextDayMatch[1].toLowerCase();
      const dayNum = DAY_MAP[dayName];
      if (dayNum !== undefined) {
        const resolvedDate = endOfDay(getNextDay(dayNum));
        if (extractedHour !== null) {
          resolvedDate.setHours(extractedHour, extractedMinute, 0, 0);
        }
        deadline = resolvedDate.getTime();
        title = title.replace(NEXT_DAY_PATTERN, '').trim();
      }
    }
  }

  // --- If time extracted but no date, assume today (or tomorrow if past) ---
  if (extractedHour !== null && !deadline) {
    const target = new Date();
    target.setHours(extractedHour, extractedMinute, 0, 0);
    if (target.getTime() < Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    deadline = target.getTime();
  }

  // Clean up extra whitespace
  title = title.replace(/\s{2,}/g, ' ').trim();

  return { title, deadline, priority };
}
