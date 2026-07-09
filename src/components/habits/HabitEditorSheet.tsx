import { useEffect, useState } from 'react';
import { Sheet } from '../../ui/Modal';
import { Icon } from '../../ui/Icon';
import { haptic } from '../../core/utils/haptics';
import type { Habit, HabitScheduleType, HabitTimeOfDay } from '../../core/types/habits';
import { DEFAULT_HABIT } from '../../core/types/habits';
import type { EnergyLevel } from '../../core/types';

interface Props {
  open: boolean;
  habit?: Habit | null; // editing an existing habit, or null/undefined to create
  onClose: () => void;
  onSave: (values: Partial<Habit>) => void;
  onDelete?: () => void;
}

const ICONS = ['flame-outline', 'barbell-outline', 'book-outline', 'water-outline', 'walk-outline', 'moon-outline', 'leaf-outline', 'heart-outline', 'musical-note', 'brush-outline', 'cash-outline', 'fitness-outline'];
const COLORS = ['#F59E0B', '#EF4444', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const SCHEDULES: { type: HabitScheduleType; label: string }[] = [
  { type: 'daily', label: 'Every day' },
  { type: 'weekdays', label: 'Weekdays' },
  { type: 'x_per_week', label: 'X / week' },
];
const TIMES: HabitTimeOfDay[] = ['anytime', 'morning', 'afternoon', 'evening'];
const TIME_LABELS: Record<HabitTimeOfDay, string> = { anytime: 'Anytime', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const ENERGIES: EnergyLevel[] = ['low', 'medium', 'high'];
const ENERGY_LABELS: Record<EnergyLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export function HabitEditorSheet({ open, habit, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_HABIT.icon);
  const [color, setColor] = useState(DEFAULT_HABIT.color);
  const [scheduleType, setScheduleType] = useState<HabitScheduleType>('daily');
  const [target, setTarget] = useState(3);
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>('anytime');
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [tiny, setTiny] = useState('');
  const [reminder, setReminder] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setName(habit?.name ?? '');
    setIcon(habit?.icon ?? DEFAULT_HABIT.icon);
    setColor(habit?.color ?? DEFAULT_HABIT.color);
    setScheduleType(habit?.scheduleType ?? 'daily');
    setTarget(habit?.scheduleTarget ?? 3);
    setTimeOfDay(habit?.timeOfDay ?? 'anytime');
    setEnergy(habit?.energyLevel ?? 'medium');
    setTiny(habit?.tinyVersion ?? '');
    setReminder(habit?.reminderTime ?? '');
  }, [open, habit]);

  const save = () => {
    if (!name.trim()) return;
    haptic('success');
    onSave({
      name: name.trim(), icon, color, scheduleType,
      scheduleTarget: scheduleType === 'x_per_week' ? Math.max(1, Math.min(7, target)) : 1,
      timeOfDay, energyLevel: energy, tinyVersion: tiny.trim(),
      reminderTime: reminder || null,
    });
    onClose();
  };

  const field: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--c-text-tertiary)', margin: '16px 0 8px' };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '8px 12px', borderRadius: 10, fontSize: 14, fontWeight: active ? 700 : 500,
    border: `1px solid ${active ? color : 'var(--c-gray200)'}`,
    background: active ? `${color}1a` : 'var(--c-gray50)', color: active ? color : 'var(--c-text-secondary)',
  });

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="tody-scroll" style={{ padding: '4px 16px 20px', maxHeight: '78dvh', overflowY: 'auto' }}>
        <div style={{ fontSize: 18, fontWeight: 700, paddingBottom: 4 }}>{habit ? 'Edit habit' : 'New habit'}</div>

        <input
          autoFocus={!habit}
          value={name}
          placeholder="Habit name (e.g. Read 10 pages)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          style={{ width: '100%', height: 48, fontSize: 17, background: 'var(--c-surface)', border: '1px solid var(--c-gray200)', borderRadius: 'var(--r-input)', padding: '0 14px', marginTop: 10 }}
        />

        <div style={field}>Icon</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ICONS.map((ic) => (
            <button key={ic} aria-label={ic} onClick={() => { haptic('selection'); setIcon(ic); }} style={{ width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${icon === ic ? color : 'var(--c-gray200)'}`, background: icon === ic ? `${color}1a` : 'transparent' }}>
              <Icon name={ic} size={20} color={icon === ic ? color : 'var(--c-gray500)'} />
            </button>
          ))}
        </div>

        <div style={field}>Color</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {COLORS.map((c) => (
            <button key={c} aria-label={`color ${c}`} onClick={() => { haptic('selection'); setColor(c); }} style={{ width: 34, height: 34, borderRadius: 17, background: c, border: color === c ? '3px solid var(--c-text)' : '3px solid transparent' }} />
          ))}
        </div>

        <div style={field}>Schedule</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {SCHEDULES.map((s) => (
            <button key={s.type} onClick={() => { haptic('selection'); setScheduleType(s.type); }} style={{ flex: 1, ...chip(scheduleType === s.type) }}>{s.label}</button>
          ))}
        </div>
        {scheduleType === 'x_per_week' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 14, color: 'var(--c-text-secondary)' }}>Times per week</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              <button aria-label="decrease" onClick={() => setTarget((t) => Math.max(1, t - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--c-gray200)' }}><Icon name="remove" size={16} /></button>
              <span style={{ fontSize: 18, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{target}</span>
              <button aria-label="increase" onClick={() => setTarget((t) => Math.min(7, t + 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--c-gray200)' }}><Icon name="add" size={16} /></button>
            </div>
          </div>
        )}

        <div style={field}>Time of day</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TIMES.map((t) => (
            <button key={t} onClick={() => { haptic('selection'); setTimeOfDay(t); }} style={chip(timeOfDay === t)}>{TIME_LABELS[t]}</button>
          ))}
        </div>

        <div style={field}>Energy</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ENERGIES.map((e) => (
            <button key={e} onClick={() => { haptic('selection'); setEnergy(e); }} style={{ flex: 1, ...chip(energy === e) }}>{ENERGY_LABELS[e]}</button>
          ))}
        </div>

        <div style={field}>Tiny version <span style={{ textTransform: 'none', fontWeight: 400 }}>(the “bad day” minimum)</span></div>
        <input
          value={tiny}
          placeholder="e.g. Just one page"
          onChange={(e) => setTiny(e.target.value)}
          style={{ width: '100%', height: 44, fontSize: 15, background: 'var(--c-surface)', border: '1px solid var(--c-gray200)', borderRadius: 'var(--r-input)', padding: '0 14px' }}
        />

        <div style={field}>Reminder <span style={{ textTransform: 'none', fontWeight: 400 }}>(while the app is open)</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="time" aria-label="Reminder time" value={reminder} onChange={(e) => setReminder(e.target.value)} style={{ flex: 1, height: 44, fontSize: 15, background: 'var(--c-surface)', border: '1px solid var(--c-gray200)', borderRadius: 'var(--r-input)', padding: '0 12px' }} />
          {reminder && <button aria-label="Clear reminder" onClick={() => setReminder('')} style={{ padding: 8 }}><Icon name="close-circle" size={20} color="var(--c-gray400)" /></button>}
        </div>

        <button onClick={save} disabled={!name.trim()} style={{ width: '100%', height: 50, marginTop: 20, borderRadius: 'var(--r-button)', background: name.trim() ? 'var(--c-surface-dark)' : 'var(--c-gray200)', color: name.trim() ? 'var(--c-white)' : 'var(--c-gray400)', fontSize: 16, fontWeight: 700 }}>
          {habit ? 'Save changes' : 'Create habit'}
        </button>
        {habit && onDelete && (
          <button onClick={() => { if (window.confirm(`Delete “${habit.name}”? This clears its history.`)) { haptic('medium'); onDelete(); onClose(); } }} style={{ width: '100%', height: 44, marginTop: 8, color: '#e06767', fontSize: 15, fontWeight: 600 }}>
            Delete habit
          </button>
        )}
      </div>
    </Sheet>
  );
}
