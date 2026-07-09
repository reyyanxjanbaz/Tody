import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { useTasks } from '../core/context/TaskContext';
import { useHabits } from '../core/context/HabitContext';
import { todayKey } from '../core/utils/dayKey';
import { daysFromNow } from '../core/utils/dateUtils';
import { setFocusList } from '../utils/focusList';
import type { Task } from '../core/types';

const DONE_KEY = (day: string) => `tody:ritualDone:${day}`;

/**
 * Phase 6.2 — Daily Planning Ritual. A dismissible card shown once on the first
 * visit of a new day: three short, skippable steps that turn "where do I even
 * start" into a 20-second routine — gently reschedule overdue, pick today's
 * top-3 (which seeds Focus mode), then a glance at habits. Calm, not nagging.
 */
export function PlanningRitual({ onStartFocus }: { onStartFocus?: () => void }) {
  const day = todayKey();
  const { tasks, deferTask } = useTasks();
  const { habits, getStreakInfo } = useHabits();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DONE_KEY(day)) === '1'; } catch { return false; }
  });
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);

  const overdue = useMemo(
    () => tasks.filter((t) => !t.isCompleted && !t.parentId && t.deadline && daysFromNow(t.deadline) < 0),
    [tasks],
  );
  const todayCandidates = useMemo(
    () => tasks.filter((t) => !t.isCompleted && !t.parentId).slice(0, 12),
    [tasks],
  );
  const habitsDue = useMemo(() => habits.filter((h) => getStreakInfo(h.id).dueToday).length, [habits, getStreakInfo]);

  const finish = () => {
    if (picks.length) setFocusList(picks, day);
    try { localStorage.setItem(DONE_KEY(day), '1'); } catch { /* ignore */ }
    setDismissed(true);
    if (picks.length && onStartFocus) onStartFocus();
  };
  const skip = () => { try { localStorage.setItem(DONE_KEY(day), '1'); } catch { /* ignore */ } setDismissed(true); };

  // Only surface when there's something worth planning.
  if (dismissed || (tasks.length === 0 && habits.length === 0)) return null;

  const togglePick = (t: Task) => {
    haptic('selection');
    setPicks((p) => p.includes(t.id) ? p.filter((x) => x !== t.id) : p.length < 3 ? [...p, t.id] : p);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      style={{ margin: '8px 16px 4px', borderRadius: 'var(--r-card)', border: '1px solid var(--c-border)', background: 'var(--c-surface)', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 6px' }}>
        <Icon name="sunny-outline" size={18} color="#F59E0B" />
        <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Plan your day</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i <= step ? 'var(--c-text)' : 'var(--c-gray200)' }} />
          ))}
        </div>
        <button onClick={skip} aria-label="Dismiss planning" style={{ padding: 4 }}><Icon name="close" size={18} color="var(--c-gray400)" /></button>
      </div>

      <div style={{ padding: '4px 14px 14px' }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginBottom: 10 }}>
                {overdue.length > 0 ? `${overdue.length} task${overdue.length > 1 ? 's' : ''} slipped past. Give them a fresh start?` : 'Nothing overdue — clean slate. ✨'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {overdue.length > 0 && (
                  <button onClick={() => { haptic('medium'); overdue.forEach((t) => deferTask(t.id, 'tomorrow')); setStep(1); }} style={primary}>
                    Move to tomorrow
                  </button>
                )}
                <button onClick={() => setStep(1)} style={ghost}>{overdue.length > 0 ? 'Leave them' : 'Next'}</button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginBottom: 10 }}>Pick up to 3 to focus on today.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 190, overflowY: 'auto' }} className="tody-scroll">
                {todayCandidates.map((t) => {
                  const on = picks.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => togglePick(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, textAlign: 'left', border: `1px solid ${on ? 'var(--c-text)' : 'var(--c-gray200)'}`, background: on ? 'var(--c-gray50)' : 'transparent' }}>
                      <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? '#22C55E' : 'var(--c-gray400)'} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => setStep(2)} style={primary}>{picks.length ? `Continue · ${picks.length}` : 'Skip'}</button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginBottom: 10 }}>
                {habits.length === 0 ? 'Tip: build a habit to grow a streak. 🔥' : habitsDue > 0 ? `${habitsDue} habit${habitsDue > 1 ? 's' : ''} due today — keep your streaks alive.` : 'All habits handled today. 🎉'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { haptic('success'); finish(); }} style={primary}>
                  {picks.length ? 'Start focused' : "Let's go"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const primary: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, background: 'var(--c-surface-dark)', color: 'var(--c-white)', fontSize: 14, fontWeight: 700 };
const ghost: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 600 };
