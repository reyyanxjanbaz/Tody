import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTaskInput } from '../../src/core/utils/taskParser';

describe('Phase 1.9 — taskParser.parseTaskInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 10, 0, 0, 0)); // Mon Jun 15 2026, 10:00
  });
  afterEach(() => vi.useRealTimers());

  it('extracts "today" as an end-of-day deadline and strips the keyword', () => {
    const r = parseTaskInput('buy groceries today');
    expect(r.title).toBe('buy groceries');
    const d = new Date(r.deadline!);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getDate()).toBe(15);
  });

  it('extracts "tomorrow" as tomorrow end-of-day', () => {
    const r = parseTaskInput('buy groceries tomorrow');
    expect(new Date(r.deadline!).getDate()).toBe(16);
  });

  it('"urgent" sets priority high, deadline today, and strips the keyword', () => {
    const r = parseTaskInput('urgent fix deploy');
    expect(r.title).toBe('fix deploy');
    expect(r.priority).toBe('high');
    expect(new Date(r.deadline!).getHours()).toBe(23);
  });

  it('"important"/"high priority" sets priority high without forcing a deadline', () => {
    const r = parseTaskInput('important write proposal');
    expect(r.title).toBe('write proposal');
    expect(r.priority).toBe('high');
    expect(r.deadline).toBeNull();
  });

  it('"whenever"/"low priority" sets priority low', () => {
    const r = parseTaskInput('learn rust whenever');
    expect(r.title).toBe('learn rust');
    expect(r.priority).toBe('low');
    expect(r.deadline).toBeNull();
  });

  it('extracts an explicit "at 3pm" time onto today\'s deadline', () => {
    const r = parseTaskInput('call dentist at 3pm');
    expect(r.title).toBe('call dentist');
    const d = new Date(r.deadline!);
    expect(d.getHours()).toBe(15);
    expect(d.getDate()).toBe(15);
  });

  it('bare hour heuristic: 1-7 assumed PM, 8-12 assumed AM', () => {
    const pm = parseTaskInput('meeting at 5');
    expect(new Date(pm.deadline!).getHours()).toBe(17);
    const am = parseTaskInput('meeting at 9');
    expect(new Date(am.deadline!).getHours()).toBe(9);
  });

  it('"next friday" resolves to the coming Friday', () => {
    const r = parseTaskInput('meeting next friday at 10am');
    const d = new Date(r.deadline!);
    expect(d.getDay()).toBe(5);
    expect(d.getHours()).toBe(10);
  });

  it('a bare time with no date rolls to tomorrow if already past today', () => {
    // "now" is 10:00 — 9am has already passed today.
    const r = parseTaskInput('standup at 9am');
    const d = new Date(r.deadline!);
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(9);
  });

  it('collapses extra whitespace left behind after stripping keywords', () => {
    const r = parseTaskInput('urgent   fix    the   thing');
    expect(r.title).toBe('fix the thing');
  });

  it('plain input with no keywords has no deadline and default priority', () => {
    const r = parseTaskInput('read a book');
    expect(r).toEqual({ title: 'read a book', deadline: null, priority: 'none' });
  });
});
