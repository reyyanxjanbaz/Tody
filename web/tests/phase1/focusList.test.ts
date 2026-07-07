import { beforeEach, describe, expect, it } from 'vitest';
import { getFocusList, setFocusList } from '../../src/utils/focusList';

describe('Phase 6.2 — focusList', () => {
  beforeEach(() => localStorage.clear());

  it('persists and reads back the chosen ids for a day', () => {
    setFocusList(['a', 'b'], '2026-03-16');
    expect(getFocusList('2026-03-16')).toEqual(['a', 'b']);
  });

  it('caps the list at three ids', () => {
    setFocusList(['a', 'b', 'c', 'd', 'e'], '2026-03-16');
    expect(getFocusList('2026-03-16')).toEqual(['a', 'b', 'c']);
  });

  it('is scoped per day', () => {
    setFocusList(['x'], '2026-03-16');
    expect(getFocusList('2026-03-17')).toEqual([]);
  });
});
