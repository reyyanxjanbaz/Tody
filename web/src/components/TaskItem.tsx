import { useRef } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { Icon } from '../ui/Icon';
import { Checkbox } from '../ui/Checkbox';
import { useTheme } from '../core/context/ThemeContext';
import type { Task, Priority, EnergyLevel } from '../core/types';
import { formatDeadline, formatCompletedDate, daysFromNow } from '../core/utils/dateUtils';
import { formatOverdueGently } from '../core/utils/decay';
import { formatMinutes, getElapsedMinutes } from '../core/utils/timeTracking';
import { formatTimeUntil } from '../utils/timeUntil';
import { useNow } from '../utils/useNow';
import { useCelebration } from './Celebration';
import { recordSwipeAction } from '../core/utils/swipeMemory';
import { haptic } from '../core/utils/haptics';
import { SPRING_SNAPPY, SPRING_CRITICAL, SWIPE_THRESHOLD, FLING_VELOCITY } from '../theme/motion';

const ENERGY_ICONS: Record<EnergyLevel, { name: string; color: string; dark: string }> = {
  high: { name: 'flash', color: '#F59E0B', dark: '#FBBF24' },
  medium: { name: 'flash-outline', color: '#8B8B8B', dark: '#A0A0A0' },
  low: { name: 'moon-outline', color: '#93C5FD', dark: '#60A5FA' },
};
const PRIORITY_ICONS: Record<Priority, { name: string; color: string; dark: string } | null> = {
  high: { name: 'flag', color: '#EF4444', dark: '#F87171' },
  medium: { name: 'flag', color: '#F59E0B', dark: '#FBBF24' },
  low: { name: 'flag-outline', color: '#93C5FD', dark: '#60A5FA' },
  none: null,
};

interface TaskItemProps {
  task: Task;
  onPress: (task: Task) => void;
  onComplete: (id: string) => void;
  onDefer: (id: string) => void;
  onRevive?: (id: string) => void;
  onStart?: (id: string) => void;
  onCompleteTimed?: (id: string, adjustedMinutes?: number) => void;
  isLocked?: boolean;
  isLastChild?: boolean;
  ancestorContinuation?: boolean[];
  onLongPress?: (task: Task) => void;
  checkedOverride?: boolean;
}

export function TaskItem({
  task,
  onPress,
  onComplete,
  onDefer,
  onRevive,
  onStart,
  onCompleteTimed,
  isLocked = false,
  isLastChild = false,
  ancestorContinuation = [],
  onLongPress,
  checkedOverride,
}: TaskItemProps) {
  const { colors, isDark } = useTheme();
  const { celebrate } = useCelebration();
  const checkboxRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const crossed = useRef(false);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const dragged = useRef(false);

  const now = useNow();
  const isOverdue = task.deadline ? daysFromNow(task.deadline) < 0 : false;
  // Relative "in 2h" chip for near-future deadlines (a time-blindness aid).
  // Only when upcoming & urgent (<6h out) — overdue is already surfaced above.
  const timeUntil = (!task.isCompleted && !isOverdue && task.deadline)
    ? formatTimeUntil(task.deadline, now)
    : null;
  const isInProgress = !!task.startedAt && !task.isCompleted;
  const depth = task.depth || 0;
  const indentation = depth * 20;
  const overdueLabel = formatOverdueGently(task);

  const PRIORITY_BAR: Record<Priority, string> = {
    high: colors.text,
    medium: colors.gray500,
    low: colors.gray200,
    none: 'transparent',
  };

  const leftLabel = !task.startedAt && !task.isCompleted && onStart ? 'START' : 'DEFER';
  const rightLabel = isOverdue && onRevive ? 'REVIVE' : isInProgress ? 'COMPLETE' : 'DONE';

  const leftOpacity = useTransform(x, [0, SWIPE_THRESHOLD * 0.6], [0, 1]);
  const leftScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.8, 1]);
  const rightOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const rightScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);

  const swipeRight = () => {
    if (!task.startedAt && !task.isCompleted && onStart) {
      recordSwipeAction('start');
      haptic('medium');
      onStart(task.id);
    } else {
      recordSwipeAction('defer');
      haptic('medium');
      onDefer(task.id);
    }
  };
  const swipeLeft = () => {
    if (isOverdue && onRevive) {
      recordSwipeAction('revive');
      haptic('success');
      onRevive(task.id);
    } else if (isInProgress && onCompleteTimed) {
      recordSwipeAction('complete');
      haptic('success');
      completeWithCheer(() => onCompleteTimed(task.id));
    } else {
      recordSwipeAction('complete');
      haptic('success');
      completeWithCheer(() => onComplete(task.id));
    }
  };

  // Complete + fire a confetti burst from the checkbox (no-op under reduce-motion).
  const completeWithCheer = (fn: () => void) => {
    if (!checked) {
      const r = checkboxRef.current?.getBoundingClientRect();
      if (r) celebrate(r.left + r.width / 2, r.top + r.height / 2);
    }
    fn();
  };

  const startLong = () => {
    longFired.current = false;
    if (!onLongPress) return;
    longTimer.current = setTimeout(() => {
      longFired.current = true;
      haptic('medium');
      onLongPress(task);
    }, 350);
  };
  const clearLong = () => {
    if (longTimer.current) clearTimeout(longTimer.current);
  };

  const startedOnCheckbox = useRef(false);
  const bind = useDrag(
    ({ first, movement: [mx], velocity: [vx], last, tap, event }) => {
      if (first) {
        dragged.current = false;
        // A press that begins on the checkbox must not arm long-press or swipe
        // — it's a toggle, handled by the checkbox's own click.
        startedOnCheckbox.current = !!(event?.target as HTMLElement | null)?.closest?.('[data-no-drag]');
        if (!startedOnCheckbox.current) startLong();
      }
      if (startedOnCheckbox.current) {
        if (last) clearLong();
        return;
      }
      if (Math.abs(mx) > 6) {
        dragged.current = true;
        clearLong();
      }
      if (tap) {
        clearLong();
        return;
      }
      if (!last) {
        if (task.isCompleted) return; // no swipe on completed
        x.set(mx);
        const isCrossed = Math.abs(mx) > SWIPE_THRESHOLD;
        if (isCrossed && !crossed.current) {
          crossed.current = true;
          haptic('light');
        } else if (!isCrossed) {
          crossed.current = false;
        }
        return;
      }
      // last
      clearLong();
      if (!task.isCompleted) {
        const activate = Math.abs(mx) > SWIPE_THRESHOLD || Math.abs(vx) > FLING_VELOCITY / 1000;
        animate(x, 0, activate ? SPRING_CRITICAL : SPRING_SNAPPY);
        crossed.current = false;
        if (activate) {
          if (mx > 0) swipeRight();
          else swipeLeft();
        }
      }
      setTimeout(() => (dragged.current = false), 0);
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true } },
  );

  const handleClick = () => {
    if (dragged.current || longFired.current) {
      longFired.current = false;
      return;
    }
    onPress(task);
  };

  const checked = checkedOverride !== undefined ? checkedOverride : task.isCompleted;

  return (
    <div style={{ position: 'relative', background: 'var(--c-background)' }}>
      {/* Swipe action backgrounds */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#2A2A2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: 24,
        }}
      >
        <motion.span style={{ opacity: leftOpacity, scale: leftScale, ...swipeText }}>{leftLabel}</motion.span>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#1A1A1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 24,
        }}
      >
        <motion.span style={{ opacity: rightOpacity, scale: rightScale, ...swipeText }}>{rightLabel}</motion.span>
      </div>

      {/* Main row — transform on motion.div, gestures on inner plain div */}
      <motion.div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'var(--c-background)',
          x,
          touchAction: 'pan-y',
          cursor: 'pointer',
        }}
      >
        <div
          {...bind()}
          onClick={handleClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 56,
            padding: `14px 16px 14px ${12 + indentation}px`,
            position: 'relative',
          }}
        >
          {/* Subtask connector lines */}
          {depth > 0 &&
            ancestorContinuation.map((cont, i) =>
              cont ? (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 1,
                    background: colors.gray400,
                    left: 12 + (i + 1) * 20 - 14,
                    top: 0,
                    bottom: 0,
                  }}
                />
              ) : null,
            )}
          {depth > 0 && (
            <>
              <span
                style={{
                  position: 'absolute',
                  width: 1,
                  background: colors.gray400,
                  left: 12 + indentation - 14,
                  top: 0,
                  height: isLastChild ? '50%' : '100%',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  height: 1,
                  width: 14,
                  background: colors.gray400,
                  left: 12 + indentation - 14,
                  top: '50%',
                }}
              />
            </>
          )}

          {/* Priority bar */}
          <span
            style={{
              width: 4,
              alignSelf: 'stretch',
              marginRight: 8,
              borderRadius: 2,
              background: PRIORITY_BAR[task.priority],
            }}
          />

          {isLocked && (
            <span style={{ marginRight: 4, display: 'flex' }}>
              <Icon name="lock-closed" size={11} color={colors.gray500} />
            </span>
          )}

          {/* Checkbox. NOTE: we deliberately do NOT stopPropagation on
              pointerdown here. @use-gesture's filterTaps installs a
              capture-phase click listener on the bound row that suppresses any
              click when it didn't see a tap gesture — and swallowing the
              pointerdown made every stationary checkbox press look like a
              non-tap, so the toggle click never landed. Letting pointerdown
              reach the gesture lets a still press register as a tap (not
              suppressed); the click-level stopPropagation still keeps the tap
              from bubbling up and opening the task detail. */}
          <div
            ref={checkboxRef}
            data-no-drag
            onClick={(e) => e.stopPropagation()}
            style={{ width: 28, display: 'flex', justifyContent: 'center', marginRight: 12 }}
          >
            <Checkbox checked={checked} locked={isLocked} onToggle={() => completeWithCheer(() => onComplete(task.id))} size={18} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, marginRight: 8, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: task.isCompleted ? colors.gray500 : colors.text,
                textDecoration: task.isCompleted ? 'line-through' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {task.title}
            </div>
            {task.description && (
              <div style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.description}
              </div>
            )}
            {isInProgress && task.startedAt ? (
              <div style={{ fontSize: 12, color: colors.gray600, marginTop: 2 }}>
                ● Started {formatMinutes(getElapsedMinutes(task.startedAt))} ago
                {task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}
              </div>
            ) : task.isCompleted && task.actualMinutes != null && task.actualMinutes > 0 ? (
              <div style={{ fontSize: 12, color: colors.gray600, marginTop: 2 }}>
                Took {formatMinutes(task.actualMinutes)}
                {task.estimatedMinutes ? ` · est. ${formatMinutes(task.estimatedMinutes)}` : ''}
              </div>
            ) : task.estimatedMinutes ? (
              <div style={{ fontSize: 12, color: colors.gray600, marginTop: 2 }}>est. {formatMinutes(task.estimatedMinutes)}</div>
            ) : null}
          </div>

          {/* Deadline / status tag */}
          {task.isCompleted && task.completedAt ? (
            <span style={tagStyle(colors.gray500)}>{formatCompletedDate(task.completedAt)}</span>
          ) : isOverdue && overdueLabel ? (
            <span style={tagStyle(colors.gray500)}>{overdueLabel}</span>
          ) : task.deadline ? (
            <span style={tagStyle(colors.textSecondary)}>{formatDeadline(task.deadline)}</span>
          ) : null}

          {/* Relative urgency chip — only when the deadline is close (<6h) */}
          {timeUntil?.urgent && (
            <span style={{ ...tagStyle('#F59E0B'), marginLeft: 4, fontWeight: 600 }}>{timeUntil.label}</span>
          )}

          {task.deferCount > 0 && !task.isCompleted && (
            <span style={{ ...tagStyle(colors.gray500), marginLeft: 4 }}>{task.deferCount}×</span>
          )}

          {/* Recently revived (brought back from decay) — surfaces the
              otherwise write-only revivedAt so the return is acknowledged. */}
          {!task.isCompleted && task.revivedAt != null && Date.now() - task.revivedAt < 7 * 86400000 && (
            <span
              style={{
                ...tagStyle(isDark ? '#FBBF24' : '#B45309'),
                marginLeft: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Icon name="sparkles-outline" size={11} color={isDark ? '#FBBF24' : '#B45309'} />
              Revived
            </span>
          )}

          {/* Recurring indicator — this task respawns on completion */}
          {task.isRecurring && !task.isCompleted && (
            <span style={{ marginLeft: 4, display: 'inline-flex', alignItems: 'center' }}>
              <Icon name="repeat" size={12} color={isDark ? '#A78BFA' : '#8B5CF6'} />
            </span>
          )}

          {/* Energy + priority icons */}
          <div style={{ width: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, marginLeft: 8 }}>
            {PRIORITY_ICONS[task.priority] && (
              <Icon
                name={PRIORITY_ICONS[task.priority]!.name}
                size={12}
                color={isDark ? PRIORITY_ICONS[task.priority]!.dark : PRIORITY_ICONS[task.priority]!.color}
              />
            )}
            <Icon
              name={ENERGY_ICONS[task.energyLevel].name}
              size={12}
              color={isDark ? ENERGY_ICONS[task.energyLevel].dark : ENERGY_ICONS[task.energyLevel].color}
            />
          </div>
        </div>
      </motion.div>

      {/* Dashed separator */}
      <div
        style={{
          height: 1,
          margin: '0 24px',
          backgroundImage: `repeating-linear-gradient(to right, ${colors.border} 0 4px, transparent 4px 7px)`,
        }}
      />
    </div>
  );
}

const swipeText: React.CSSProperties = {
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '2px',
};

const tagStyle = (color: string): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.2px',
  color,
  whiteSpace: 'nowrap',
});
