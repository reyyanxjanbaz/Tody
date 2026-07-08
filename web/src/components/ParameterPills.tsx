import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { formatMinutes } from '../core/utils/timeTracking';
import type { Priority, EnergyLevel, RecurringFrequency } from '../core/types';
import { RECURRENCE_SHORT } from '../core/utils/recurrence';
import { SPRING_SNAPPY } from '../theme/motion';

// ── Shared pill shell ─────────────────────────────────────────────────────────

function Pill({
  onClick,
  active,
  color,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING_SNAPPY}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 30,
        padding: '0 10px',
        borderRadius: 15,
        border: `1px solid ${active && color ? color : 'var(--c-gray200)'}`,
        background: active && color ? `${color}14` : 'var(--c-gray50)',
        color: active && color ? color : 'var(--c-gray400)',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </motion.button>
  );
}

// ── Priority ──────────────────────────────────────────────────────────────────

const PRIORITY_CYCLE: Priority[] = ['none', 'low', 'medium', 'high'];
const PRIORITY_DISPLAY: Record<Priority, { label: string; icon: string; color: string | null }> = {
  none: { label: 'Priority', icon: 'remove-outline', color: null },
  low: { label: 'Low', icon: 'flag-outline', color: '#22C55E' },
  medium: { label: 'Medium', icon: 'flag-outline', color: '#F59E0B' },
  high: { label: 'High', icon: 'flag', color: '#EF4444' },
};

export function PriorityPill({ value, onChange }: { value: Priority; onChange: (v: Priority) => void }) {
  const d = PRIORITY_DISPLAY[value];
  const active = value !== 'none';
  const color = d.color ?? 'var(--c-gray400)';
  return (
    <Pill
      active={active}
      color={d.color ?? undefined}
      onClick={() => {
        haptic('selection');
        const i = PRIORITY_CYCLE.indexOf(value);
        onChange(PRIORITY_CYCLE[(i + 1) % PRIORITY_CYCLE.length]);
      }}
    >
      <Icon name={d.icon} size={13} color={color} />
      {d.label}
    </Pill>
  );
}

// ── Energy ────────────────────────────────────────────────────────────────────

const ENERGY_CYCLE: EnergyLevel[] = ['low', 'medium', 'high'];
const ENERGY_DISPLAY: Record<EnergyLevel, { label: string; color: string }> = {
  low: { label: 'Low lift', color: '#22C55E' },
  medium: { label: 'Medium', color: '#F59E0B' },
  high: { label: 'Deep focus', color: '#EF4444' },
};

export function EnergyPill({ value, onChange }: { value: EnergyLevel; onChange: (v: EnergyLevel) => void }) {
  const d = ENERGY_DISPLAY[value];
  return (
    <Pill
      active
      color={d.color}
      onClick={() => {
        haptic('selection');
        const i = ENERGY_CYCLE.indexOf(value);
        onChange(ENERGY_CYCLE[(i + 1) % ENERGY_CYCLE.length]);
      }}
    >
      <Icon name="flash" size={13} color={d.color} />
      {d.label}
    </Pill>
  );
}

// ── Recurrence ────────────────────────────────────────────────────────────────

const RECURRENCE_CYCLE: (RecurringFrequency | null)[] = [null, 'daily', 'weekly', 'biweekly', 'monthly'];
const RECURRENCE_COLOR = '#8B5CF6';

export function RecurrencePill({
  value,
  onChange,
}: {
  value: RecurringFrequency | null;
  onChange: (v: RecurringFrequency | null) => void;
}) {
  const active = value != null;
  return (
    <Pill
      active={active}
      color={RECURRENCE_COLOR}
      onClick={() => {
        haptic('selection');
        const i = RECURRENCE_CYCLE.indexOf(value);
        onChange(RECURRENCE_CYCLE[(i + 1) % RECURRENCE_CYCLE.length]);
      }}
    >
      <Icon name={active ? 'repeat' : 'repeat-outline'} size={13} color={active ? RECURRENCE_COLOR : 'var(--c-gray400)'} />
      {active ? RECURRENCE_SHORT[value!] : 'Repeat'}
    </Pill>
  );
}

// ── Estimate / Deadline (open a picker) ───────────────────────────────────────

export function EstimatePill({ value, onPress }: { value: number | null; onPress: () => void }) {
  const has = value != null && value > 0;
  return (
    <Pill active={has} color="var(--c-gray800)" onClick={() => { haptic('selection'); onPress(); }}>
      <Icon name="time-outline" size={13} color={has ? 'var(--c-gray800)' : 'var(--c-gray400)'} />
      {has ? `~${formatMinutes(value!)}` : 'How long?'}
    </Pill>
  );
}

function formatDeadlineShort(ts: number): string {
  const date = new Date(ts);
  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
  const h = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  if (diffDays <= 0) return `Today ${h}${ampm}`;
  if (diffDays === 1) return `Tmrw ${h}${ampm}`;
  if (diffDays <= 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${M[date.getMonth()]} ${date.getDate()}`;
}

export function DeadlinePill({ value, onPress }: { value: number | null; onPress: () => void }) {
  const has = value !== null;
  return (
    <Pill active={has} color="var(--c-gray800)" onClick={() => { haptic('selection'); onPress(); }}>
      <Icon name="calendar-outline" size={13} color={has ? 'var(--c-gray800)' : 'var(--c-gray400)'} />
      {has ? formatDeadlineShort(value!) : 'Deadline'}
    </Pill>
  );
}

// ── Time Quick Pick ───────────────────────────────────────────────────────────

const TIME_OPTIONS = [5, 15, 30, 60, 120, 240];

export function TimeQuickPick({
  value,
  onChange,
  onDone,
}: {
  value: number | null;
  onChange: (m: number | null) => void;
  onDone?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '8px 16px 4px' }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {TIME_OPTIONS.map((mins) => {
          const sel = value === mins;
          return (
            <button
              key={mins}
              onClick={() => {
                haptic('selection');
                onChange(sel ? null : mins);
              }}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 8,
                border: `1px solid ${sel ? 'var(--c-surface-dark)' : 'var(--c-gray200)'}`,
                background: sel ? 'var(--c-surface-dark)' : 'transparent',
                color: sel ? 'var(--c-white)' : 'var(--c-gray500)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {formatMinutes(mins)}
            </button>
          );
        })}
      </div>
      {onDone && (
        <button
          onClick={() => { haptic('light'); onDone(); }}
          style={{ display: 'block', margin: '8px auto 0', padding: '8px 20px', fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}
        >
          Done
        </button>
      )}
    </motion.div>
  );
}

// ── Property Row (TaskDetail) ─────────────────────────────────────────────────

export function PropertyRow({
  icon,
  label,
  value,
  valueColor,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  onPress: () => void;
  hint?: string;
}) {
  return (
    <button
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        padding: '14px 12px',
        borderBottom: '1px solid var(--c-border-light)',
        textAlign: 'left',
      }}
    >
      <Icon name={icon} size={18} color="var(--c-gray500)" style={{ width: 28 }} />
      <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 500, color: valueColor ?? 'var(--c-text)', marginRight: 6 }}>{value}</span>
      <Icon name="chevron-forward" size={14} color="var(--c-gray400)" />
    </button>
  );
}
