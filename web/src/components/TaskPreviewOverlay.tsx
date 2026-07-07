import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { EnergyLevel, Priority, Task } from '../core/types';
import { getChildren } from '../core/utils/dependencyChains';
import { formatDeadline } from '../core/utils/dateUtils';
import { useTheme } from '../core/context/ThemeContext';
import { Icon } from '../ui/Icon';
import { SPRING_SNAPPY } from '../theme/motion';

interface Props {
  task: Task | null;
  allTasks: Task[];
  onClose: () => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSnooze?: (task: Task) => void;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: string; color: string }> = {
  high: { label: 'High', icon: 'flag', color: '#EF4444' },
  medium: { label: 'Medium', icon: 'flag-outline', color: '#F59E0B' },
  low: { label: 'Low', icon: 'flag-outline', color: '#22C55E' },
  none: { label: 'None', icon: 'flag-outline', color: '#9E9E9E' },
};

const ENERGY_CONFIG: Record<EnergyLevel, { label: string; icon: string; color: string }> = {
  high: { label: 'High Focus', icon: 'flash', color: '#EF4444' },
  medium: { label: 'Medium Focus', icon: 'flash-outline', color: '#F59E0B' },
  low: { label: 'Low Focus', icon: 'flash-outline', color: '#22C55E' },
};

/**
 * Web port of native TaskPreviewOverlay ("Feature 3: Long-Press Preview").
 * A long-press opens this rich, read-at-a-glance card — full title, notes,
 * deadline, priority + energy as labeled chips, subtask count — before
 * offering Edit / Add subtask / Delete. Replaces the old plain action sheet.
 */
export function TaskPreviewOverlay({ task, allTasks, onClose, onEdit, onAddSubtask, onDelete, onSnooze }: Props) {
  const { colors } = useTheme();
  const open = !!task;
  const children = task ? getChildren(task, allTasks) : [];
  const pri = task ? PRIORITY_CONFIG[task.priority] : null;
  const energy = task ? ENERGY_CONFIG[task.energyLevel] : null;
  const canAddSubtask = task ? (task.depth ?? 0) < 3 : false;

  return createPortal(
    <AnimatePresence>
      {open && task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--sp-xxl)',
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={SPRING_SNAPPY}
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'var(--c-surface)',
              borderRadius: 'var(--r-card)',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-floating)',
              padding: 20,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, marginBottom: task.description ? 8 : 14 }}>
              {task.title}
            </div>
            {task.description && (
              <div style={{ fontSize: 15, color: 'var(--c-text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
                {task.description}
              </div>
            )}

            {/* Attribute chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {pri && task.priority !== 'none' && (
                <span style={chip(pri.color)}><Icon name={pri.icon} size={13} color={pri.color} /> {pri.label}</span>
              )}
              {energy && (
                <span style={chip(energy.color)}><Icon name={energy.icon} size={13} color={energy.color} /> {energy.label}</span>
              )}
              {task.deadline && (
                <span style={chip(colors.gray500)}><Icon name="calendar-outline" size={13} color={colors.gray500} /> {formatDeadline(task.deadline)}</span>
              )}
              {children.length > 0 && (
                <span style={chip(colors.gray500)}>
                  <Icon name="git-branch-outline" size={13} color={colors.gray500} />
                  {children.filter((c) => c.isCompleted).length}/{children.length} subtasks
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => onEdit(task)} style={action('var(--c-text)')}>
                <Icon name="create-outline" size={19} color="var(--c-text-secondary)" /> Edit
              </button>
              {canAddSubtask && (
                <button onClick={() => onAddSubtask(task)} style={action('var(--c-text)')}>
                  <Icon name="add-circle-outline" size={19} color="var(--c-text-secondary)" /> Add subtask
                </button>
              )}
              {onSnooze && !task.isCompleted && (
                <button onClick={() => onSnooze(task)} style={action('var(--c-text)')}>
                  <Icon name="time-outline" size={19} color="var(--c-text-secondary)" /> Snooze
                </button>
              )}
              <button onClick={() => onDelete(task)} style={action('#e06767')}>
                <Icon name="trash-outline" size={19} color="#e06767" /> Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const chip = (color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 13, fontWeight: 600, color,
  padding: '5px 11px', borderRadius: 'var(--r-pill)',
  background: `${color}14`, border: `1px solid ${color}33`,
});

const action = (color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 12,
  width: '100%', padding: '13px 8px', fontSize: 16, fontWeight: 500,
  color, textAlign: 'left',
});
