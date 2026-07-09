import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Priority, Task } from '../core/types';
import { isTaskLocked, getChildren } from '../core/utils/dependencyChains';
import { formatDeadline } from '../core/utils/dateUtils';
import { formatMinutes } from '../core/utils/timeTracking';
import { haptic } from '../core/utils/haptics';
import { useTheme } from '../core/context/ThemeContext';
import { Icon } from '../ui/Icon';
import { SPRING_SNAPPY } from '../theme/motion';

interface FocusModeProps {
  /** Ordered candidate tasks — only the first 3 are shown, one at a time. */
  tasks: Task[];
  allTasks: Task[];
  onComplete: (id: string) => void;
  onExit: () => void;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#22C55E',
  none: '#9E9E9E',
};

const ENERGY_LABEL: Record<Task['energyLevel'], string> = {
  high: 'Deep focus',
  medium: 'Medium',
  low: 'Low lift',
};

const EXIT_HOLD_MS = 700;

/**
 * Web port of native FocusMode. A full-screen overlay showing the top-3 tasks
 * one card at a time — a calm, single-decision surface for ND users. Complete
 * advances to the next; hold the exit pill to leave (prevents accidental taps).
 */
export function FocusMode({ tasks, allTasks, onComplete, onExit }: FocusModeProps) {
  const { colors, isDark } = useTheme();
  const focusTasks = useMemo(() => tasks.slice(0, 3), [tasks]);
  const [index, setIndex] = useState(0);
  const [exitProgress, setExitProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = focusTasks[index];
  const locked = current ? isTaskLocked(current, allTasks) : false;
  const children = current ? getChildren(current, allTasks) : [];

  // Leaving the list empty (all completed) closes focus mode.
  useEffect(() => {
    if (focusTasks.length === 0) onExit();
  }, [focusTasks.length, onExit]);

  useEffect(() => {
    if (index > focusTasks.length - 1 && focusTasks.length > 0) setIndex(focusTasks.length - 1);
  }, [index, focusTasks.length]);

  const complete = () => {
    if (!current) return;
    if (locked) { haptic('warning'); return; }
    haptic('success');
    onComplete(current.id);
    if (index < focusTasks.length - 1) setIndex((i) => i); // stay on same slot; list shifts up
  };

  const startHold = () => {
    haptic('light');
    const start = Date.now();
    holdTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / EXIT_HOLD_MS);
      setExitProgress(p);
      if (p >= 1) { clearHold(); onExit(); }
    }, 16);
  };
  const clearHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setExitProgress(0);
  };
  useEffect(() => () => clearHold(), []);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        background: 'var(--c-background)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'calc(var(--safe-top) + 16px) 20px calc(var(--safe-bottom) + 16px)',
      }}
    >
      {/* Header: progress dots + count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {focusTasks.map((t, i) => (
            <span
              key={t.id}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 4,
                background: i === index ? 'var(--c-text)' : 'var(--c-gray400)',
                transition: 'width 0.25s',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 13, color: 'var(--c-text-tertiary)', fontWeight: 600, letterSpacing: '1px' }}>
          FOCUS · {Math.min(index + 1, focusTasks.length)} / {focusTasks.length}
        </span>
      </div>

      {/* Card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={SPRING_SNAPPY}
              style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10, height: 10, borderRadius: 5,
                  background: PRIORITY_COLORS[current.priority],
                  marginBottom: 20,
                }}
              />
              <h1 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.5px', marginBottom: 16 }}>
                {current.title}
              </h1>
              {current.description && (
                <p style={{ fontSize: 16, color: 'var(--c-text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                  {current.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                <span style={chip(colors.gray500)}><Icon name="flash" size={13} color={colors.gray500} /> {ENERGY_LABEL[current.energyLevel]}</span>
                {current.deadline && <span style={chip(colors.gray500)}><Icon name="calendar-outline" size={13} color={colors.gray500} /> {formatDeadline(current.deadline)}</span>}
                {current.estimatedMinutes ? <span style={chip(colors.gray500)}><Icon name="time-outline" size={13} color={colors.gray500} /> {formatMinutes(current.estimatedMinutes)}</span> : null}
              </div>

              {/* Locked → subtask checklist hint */}
              {locked && (
                <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--c-text-tertiary)' }}>
                  <Icon name="lock-closed" size={12} color="var(--c-text-tertiary)" /> Finish {children.filter((c) => !c.isCompleted).length} subtask(s) first
                </div>
              )}

              <button
                onClick={complete}
                style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 'var(--r-button)',
                  background: locked ? 'var(--c-gray200)' : 'var(--c-surface-dark)',
                  color: locked ? 'var(--c-gray500)' : 'var(--c-white)',
                  fontSize: 17,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Icon name="checkmark" size={20} color={locked ? 'var(--c-gray500)' : (isDark ? '#000' : '#fff')} />
                {locked ? 'Locked' : 'Complete'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav + hold-to-exit */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => index > 0 && setIndex((i) => i - 1)} disabled={index === 0} style={navBtn(index === 0)}>
          <Icon name="chevron-back" size={22} color={index === 0 ? 'var(--c-gray400)' : 'var(--c-text)'} />
        </button>

        <button
          onPointerDown={startHold}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          aria-label="Hold to exit focus"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--c-text-secondary)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${exitProgress * 100}%`,
              background: 'var(--c-gray200)',
              transition: 'width 0.05s linear',
            }}
          />
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="close" size={16} color="var(--c-text-secondary)" /> Hold to exit
          </span>
        </button>

        <button onClick={() => index < focusTasks.length - 1 && setIndex((i) => i + 1)} disabled={index >= focusTasks.length - 1} style={navBtn(index >= focusTasks.length - 1)}>
          <Icon name="chevron-forward" size={22} color={index >= focusTasks.length - 1 ? 'var(--c-gray400)' : 'var(--c-text)'} />
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}

const chip = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 13, color, padding: '4px 10px', borderRadius: 'var(--r-pill)',
  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
});

const navBtn = (disabled: boolean): React.CSSProperties => ({
  width: 48, height: 48, borderRadius: 24,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
  opacity: disabled ? 0.4 : 1,
});
