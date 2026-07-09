import { motion } from 'framer-motion';
import { Sheet } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { computeSnoozeTarget, SNOOZE_LABELS, type SnoozeOption } from '../core/utils/snooze';
import { usePreferences } from '../app/PreferencesContext';
import { formatDate, formatClock } from '../utils/formatWithPrefs';
import type { UserPreferences } from '../core/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (option: SnoozeOption) => void;
  title?: string;
}

const OPTIONS: { option: SnoozeOption; icon: string; color: string }[] = [
  { option: 'later-today', icon: 'cafe-outline',      color: '#F59E0B' },
  { option: 'tonight',     icon: 'moon-outline',      color: '#8B5CF6' },
  { option: 'tomorrow',    icon: 'sunny-outline',     color: '#3B82F6' },
  { option: 'weekend',     icon: 'calendar-outline',  color: '#22C55E' },
  { option: 'next-week',   icon: 'arrow-forward-circle-outline', color: '#EC4899' },
];

// The date-only sentinel (23:59) means "a day, no specific time" — show just the day.
function resolvedLabel(option: SnoozeOption, prefs: UserPreferences): string {
  const ts = computeSnoozeTarget(option);
  const d = new Date(ts);
  const isDateOnly = d.getHours() === 23 && d.getMinutes() === 59;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1);
  const isTmrw = d.toDateString() === tmrw.toDateString();

  const dayPart = sameDay ? 'Today' : isTmrw ? 'Tomorrow'
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  if (isDateOnly) return dayPart === 'Today' || dayPart === 'Tomorrow' ? dayPart : formatDate(ts, prefs);
  return `${dayPart} · ${formatClock(ts, prefs)}`;
}

/**
 * Phase 3.4 — Snooze menu. Each option shows the *resolved concrete time*
 * (a time-blindness aid): "Tomorrow · 11:59 PM" rather than an abstract label,
 * so the user knows exactly when the task returns before committing.
 */
export function SnoozeMenu({ open, onClose, onSelect, title = 'Snooze until…' }: Props) {
  const { prefs } = usePreferences();
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 8px 12px' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, padding: '4px 12px 12px' }}>{title}</h3>
        {OPTIONS.map(({ option, icon, color }, i) => (
          <motion.button
            key={option}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.03 * i }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { haptic('selection'); onSelect(option); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              padding: '14px 12px', borderRadius: 12, textAlign: 'left',
            }}
          >
            <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={19} color={color} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{SNOOZE_LABELS[option]}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--c-text-secondary)', marginTop: 1 }}>
                {resolvedLabel(option, prefs)}
              </span>
            </span>
            <Icon name="chevron-forward" size={15} color="var(--c-gray400)" />
          </motion.button>
        ))}
      </div>
    </Sheet>
  );
}
