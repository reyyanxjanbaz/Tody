import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../../src/core/context/ThemeContext';
import { AuthProvider } from '../../src/core/context/AuthContext';
import { PreferencesProvider } from '../../src/app/PreferencesContext';
import { HabitProvider, useHabits } from '../../src/core/context/HabitContext';
import { todayKey, addDaysToKey } from '../../src/core/utils/dayKey';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <AuthProvider>
          <HabitProvider>{children}</HabitProvider>
        </AuthProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

async function setup() {
  const { result } = renderHook(() => useHabits(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe('Phase 5 — HabitContext', () => {
  beforeEach(() => localStorage.clear());

  it('addHabit creates an active, order-sorted habit', async () => {
    const r = await setup();
    act(() => { r.current.addHabit({ name: 'Meditate' }); });
    expect(r.current.habits).toHaveLength(1);
    expect(r.current.habits[0].name).toBe('Meditate');
    expect(r.current.habits[0].scheduleType).toBe('daily');
  });

  it('toggleHabit marks today done then undoes it', async () => {
    const r = await setup();
    let id = '';
    act(() => { id = r.current.addHabit({ name: 'Water' }).id; });

    let res!: ReturnType<typeof r.current.toggleHabit>;
    act(() => { res = r.current.toggleHabit(id); });
    expect(res.done).toBe(true);
    expect(res.streak).toBe(1);
    expect(r.current.getStreakInfo(id).doneToday).toBe(true);

    act(() => { res = r.current.toggleHabit(id); });
    expect(res.done).toBe(false);
    expect(r.current.getStreakInfo(id).doneToday).toBe(false);
  });

  it('awards a streak freeze when a 7-day streak is reached', async () => {
    const r = await setup();
    let id = '';
    act(() => { id = r.current.addHabit({ name: 'Read' }).id; });
    // Backdate creation so the 6 prior days fall within the habit's lifetime.
    act(() => { r.current.updateHabit(id, { createdAt: new Date(2020, 0, 1).getTime() }); });
    // Seed 6 prior consecutive done days (each in its own act so state commits
    // and the streak ref updates between calls), then complete today (=7).
    for (let i = 6; i >= 1; i--) {
      // eslint-disable-next-line no-loop-func
      act(() => { r.current.toggleHabit(id, addDaysToKey(todayKey(), -i)); });
    }
    let res!: ReturnType<typeof r.current.toggleHabit>;
    act(() => { res = r.current.toggleHabit(id); });
    expect(res.streak).toBe(7);
    expect(res.milestone).toBe(7);
    expect(res.freezeEarned).toBe(true);
    expect(r.current.freezes).toBe(1);
  });

  it('habitXP is +5 per done log', async () => {
    const r = await setup();
    let id = '';
    act(() => { id = r.current.addHabit({ name: 'Stretch' }).id; });
    act(() => { r.current.toggleHabit(id, todayKey()); });
    act(() => { r.current.toggleHabit(id, addDaysToKey(todayKey(), -1)); });
    expect(r.current.habitXP).toBe(10);
  });

  it('deleteHabit soft-removes it from the active list', async () => {
    const r = await setup();
    let id = '';
    act(() => { id = r.current.addHabit({ name: 'Temp' }).id; });
    act(() => { r.current.deleteHabit(id); });
    expect(r.current.habits.find((h) => h.id === id)).toBeUndefined();
  });

  it('persists habits to storage', async () => {
    const r = await setup();
    act(() => { r.current.addHabit({ name: 'Persisted' }); });
    await waitFor(() => {
      const raw = JSON.parse(localStorage.getItem('tody:habits') || '[]');
      expect(raw.some((h: any) => h.name === 'Persisted')).toBe(true);
    }, { timeout: 1500 });
  });
});
