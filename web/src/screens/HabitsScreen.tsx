import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useHabits } from '../core/context/HabitContext';
import { usePreferences } from '../app/PreferencesContext';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';
import { EmptyState } from '../ui/EmptyState';
import { HabitCheckRow } from '../components/habits/HabitCheckRow';
import { HabitEditorSheet } from '../components/habits/HabitEditorSheet';
import { metaStreak } from '../core/utils/habitStreaks';
import { todayKey } from '../core/utils/dayKey';
import { haptic } from '../core/utils/haptics';
import type { Habit, HabitTimeOfDay } from '../core/types/habits';

const TIME_ORDER: HabitTimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];
const TIME_LABELS: Record<HabitTimeOfDay, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', anytime: 'Anytime' };
const RISK_HOUR = 18;

export function HabitsScreen() {
  const navigate = useNavigate();
  const { habits, logs, freezes, isLoading, addHabit, toggleHabit, getStreakInfo } = useHabits();
  const { prefs } = usePreferences();
  const [editorOpen, setEditorOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const infos = useMemo(() => {
    const m = new Map<string, ReturnType<typeof getStreakInfo>>();
    for (const h of habits) m.set(h.id, getStreakInfo(h.id));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, logs, prefs.weekStartsOn]);

  const meta = useMemo(() => metaStreak(habits, logs, todayKey()), [habits, logs]);

  const dueToday = habits.filter((h) => infos.get(h.id)?.dueToday);
  const remaining = dueToday.length;
  const atRisk = remaining > 0 && new Date().getHours() >= RISK_HOUR;
  const riskTiny = dueToday.find((h) => h.tinyVersion)?.tinyVersion;

  const grouped = useMemo(() => {
    const g = new Map<HabitTimeOfDay, Habit[]>();
    for (const t of TIME_ORDER) g.set(t, []);
    for (const h of habits) g.get(h.timeOfDay)?.push(h);
    return TIME_ORDER.map((t) => ({ time: t, items: g.get(t)! })).filter((s) => s.items.length > 0);
  }, [habits]);

  const onToggle = (h: Habit) => {
    const res = toggleHabit(h.id);
    if (res.freezeEarned) flash('❄️ You earned a streak freeze!');
    else if (res.milestone) flash(`🔥 ${res.milestone}-day streak! Keep it alive.`);
  };
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', paddingTop: 'var(--safe-top)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 6px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.6px', flex: 1 }}>Habits</h1>
        {freezes > 0 && (
          <span aria-label={`${freezes} streak freezes banked`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 14, fontWeight: 700, color: '#38BDF8' }}>
            <Icon name="snow-outline" size={18} color="#38BDF8" />{freezes}
          </span>
        )}
        <Pressable onPress={() => { haptic('medium'); setEditorOpen(true); }} aria-label="New habit" style={{ padding: 6 }}>
          <Icon name="add-circle" size={28} />
        </Pressable>
      </header>

      {/* Meta streak + progress line */}
      {habits.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 16px 10px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 15, fontWeight: 700 }}>
            <Icon name="flame" size={17} color={meta > 0 ? '#F97316' : 'var(--c-gray400)'} />
            {meta}-day routine
          </span>
          <span style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginLeft: 'auto' }}>
            {remaining === 0 ? 'All done today 🎉' : `${remaining} to go today`}
          </span>
        </div>
      )}

      {/* Complete-today-or-lose-it banner (classic streak pressure) */}
      <AnimatePresence>
        {atRisk && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ margin: '0 16px 8px', padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#EF4444' }}>
              <Icon name="alert-circle-outline" size={17} color="#EF4444" /> Complete today or lose your streak
            </div>
            {riskTiny && (
              <div style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginTop: 4 }}>
                Low on energy? Just do the tiny version: <strong>{riskTiny}</strong>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}>
        {!isLoading && habits.length === 0 ? (
          <div style={{ padding: '32px 20px' }}>
            <EmptyState title="Build your first habit" subtitle="Small, daily, streak-powered. Tap ＋ to start." icon="flame-outline" />
          </div>
        ) : (
          grouped.map((section) => (
            <div key={section.time}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--c-text-tertiary)', padding: '16px 16px 4px' }}>
                {TIME_LABELS[section.time].toUpperCase()}
              </div>
              {section.items.map((h) => {
                const info = infos.get(h.id)!;
                return (
                  <HabitCheckRow key={h.id} habit={h} info={info} onToggle={() => onToggle(h)} onOpen={() => navigate(`/habits/${h.id}`)} />
                );
              })}
            </div>
          ))
        )}
      </div>

      <HabitEditorSheet open={editorOpen} onClose={() => setEditorOpen(false)} onSave={(v) => addHabit(v)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-bottom) + 16px)', background: 'var(--c-surface-dark)', color: 'var(--c-white)', borderRadius: 12, padding: '14px 16px', fontSize: 15, fontWeight: 600, textAlign: 'center', boxShadow: 'var(--shadow-floating)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
