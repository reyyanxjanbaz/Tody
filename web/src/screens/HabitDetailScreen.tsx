import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHabits } from '../core/context/HabitContext';
import { usePreferences } from '../app/PreferencesContext';
import { useTheme } from '../core/context/ThemeContext';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { HabitEditorSheet } from '../components/habits/HabitEditorSheet';
import { StreakFlame } from '../components/habits/StreakFlame';
import { buildLogMap, isDueOn } from '../core/utils/habitStreaks';
import { addDaysToKey, todayKey } from '../core/utils/dayKey';

const WEEKS = 18; // ~4 months of heatmap

export function HabitDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { prefs } = usePreferences();
  const { getHabit, logsFor, getStreakInfo, updateHabit, deleteHabit } = useHabits();
  const [editOpen, setEditOpen] = useState(false);

  const habit = getHabit(id);
  const logs = logsFor(id);
  const info = habit ? getStreakInfo(id) : null;

  const grid = useMemo(() => {
    if (!habit) return [];
    const map = buildLogMap(logs);
    const start = prefs.weekStartsOn === 'monday' ? 1 : 0;
    // Anchor to the start of the current week, then walk back WEEKS columns.
    const today = todayKey();
    const todayDow = new Date(today).getDay();
    const backToWeekStart = (todayDow - start + 7) % 7;
    const thisWeekStart = addDaysToKey(today, -backToWeekStart);
    const cols: { key: string; state: 'done' | 'frozen' | 'missed' | 'off' | 'future' }[][] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const col: typeof cols[number] = [];
      const weekStart = addDaysToKey(thisWeekStart, -w * 7);
      for (let d = 0; d < 7; d++) {
        const key = addDaysToKey(weekStart, d);
        const status = map.get(key);
        let state: 'done' | 'frozen' | 'missed' | 'off' | 'future';
        if (key > today) state = 'future';
        else if (status === 'done') state = 'done';
        else if (status === 'frozen') state = 'frozen';
        else if (isDueOn(habit, key) && key !== today) state = 'missed';
        else state = 'off';
        col.push({ key, state });
      }
      cols.push(col);
    }
    return cols;
  }, [habit, logs, prefs.weekStartsOn]);

  if (!habit) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-secondary)' }}>
        <button onClick={() => navigate('/habits')} style={{ fontSize: 16 }}>Habit not found — back to Habits</button>
      </div>
    );
  }

  const cell = (state: string): string => {
    switch (state) {
      case 'done': return habit.color;
      case 'frozen': return '#38BDF8';
      case 'missed': return isDark ? '#3a2020' : '#F3D6D6';
      case 'off': return isDark ? '#1c1c1c' : '#EEEEEE';
      default: return 'transparent';
    }
  };

  const stat = (label: string, value: string | number) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', paddingTop: 'var(--safe-top)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 6px' }}>
        <Pressable onPress={() => navigate('/habits')} aria-label="Back to habits" style={{ padding: 4 }}><Icon name="chevron-back" size={26} /></Pressable>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: `${habit.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={habit.icon} size={18} color={habit.color} />
        </span>
        <span style={{ flex: 1, fontSize: 20, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
        <Pressable onPress={() => setEditOpen(true)} aria-label="Edit habit" style={{ padding: 6 }}><Icon name="create-outline" size={22} /></Pressable>
      </header>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, padding: '8px 20px', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 18px' }}>
          <StreakFlame streak={info!.current} size={20} atRisk={info!.dueToday} />
          <span style={{ fontSize: 14, color: 'var(--c-text-secondary)' }}>{info!.dueToday ? 'Due today — keep it alive' : info!.doneToday ? 'Done today ✓' : 'Not due today'}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, background: 'var(--c-surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--c-border-light)', padding: '16px 8px', marginBottom: 20 }}>
          {stat('Current', info!.current)}
          {stat('Best', info!.best)}
          {stat('Complete', `${info!.completionRate}%`)}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--c-text-tertiary)', marginBottom: 10 }}>CHAIN</div>
        <div className="tody-scroll" style={{ overflowX: 'auto', paddingBottom: 6 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {grid.map((col, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {col.map((c) => (
                  <div key={c.key} title={c.key} style={{ width: 12, height: 12, borderRadius: 3, background: cell(c.state), border: c.state === 'off' || c.state === 'future' ? '1px solid transparent' : 'none' }} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => updateHabit(habit.id, { archivedAt: habit.archivedAt ? null : Date.now() })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, padding: '12px 0', color: 'var(--c-text-secondary)', fontSize: 15 }}
        >
          <Icon name="archive-outline" size={18} color="var(--c-text-secondary)" /> {habit.archivedAt ? 'Unarchive habit' : 'Archive habit'}
        </button>
      </div>

      <HabitEditorSheet
        open={editOpen}
        habit={habit}
        onClose={() => setEditOpen(false)}
        onSave={(v) => updateHabit(habit.id, v)}
        onDelete={() => { deleteHabit(habit.id); navigate('/habits'); }}
      />
    </div>
  );
}
