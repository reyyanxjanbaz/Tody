import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';
import { Checkbox } from '../../ui/Checkbox';
import { StreakFlame } from './StreakFlame';
import { useCelebration } from '../Celebration';
import { haptic } from '../../core/utils/haptics';
import type { Habit, HabitStreakInfo } from '../../core/types/habits';

interface Props {
  habit: Habit;
  info: HabitStreakInfo;
  onToggle: (origin: { x: number; y: number }) => void;
  onOpen: () => void;
}

/**
 * Phase 5 — one habit's row in the daily checklist. Big tap target, the streak
 * flame on the right, a confetti burst on completion. Tapping the body opens
 * the habit's detail/heatmap.
 */
export function HabitCheckRow({ habit, info, onToggle, onOpen }: Props) {
  const { celebrate } = useCelebration();
  const boxRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    haptic(info.doneToday ? 'light' : 'success');
    const r = boxRef.current?.getBoundingClientRect();
    const origin = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
    if (!info.doneToday) celebrate(origin.x, origin.y);
    onToggle(origin);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <div ref={boxRef} style={{ display: 'flex' }}>
        <Checkbox checked={info.doneToday} onToggle={toggle} size={22} />
      </div>
      <button
        onClick={onOpen}
        aria-label={`Open ${habit.name}`}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${habit.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={habit.icon} size={18} color={habit.color} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <motion.span
            animate={{ opacity: info.doneToday ? 0.5 : 1 }}
            style={{
              display: 'block', fontSize: 16, fontWeight: 600,
              textDecoration: info.doneToday ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {habit.name}
          </motion.span>
        </span>
      </button>
      <StreakFlame streak={info.current} atRisk={info.dueToday} />
    </div>
  );
}
