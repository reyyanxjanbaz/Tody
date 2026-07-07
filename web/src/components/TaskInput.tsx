import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import { useTheme } from '../core/context/ThemeContext';
import type { Priority, EnergyLevel, Category, RecurringFrequency } from '../core/types';
import { EnergyPill, PriorityPill, EstimatePill, DeadlinePill, TimeQuickPick, RecurrencePill } from './ParameterPills';
import { CategoryPill } from '../ui/CategoryPill';
import { DeadlineSnapper } from './DeadlineSnapper';

export interface TaskInputParams {
  estimatedMinutes?: number;
  energyLevel?: EnergyLevel;
  priority?: Priority;
  deadline?: number | null;
  category?: string;
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency | null;
}

interface TaskInputProps {
  onSubmit: (text: string, params?: TaskInputParams) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  defaultCategory?: string;
  categories?: Category[];
}

// ── Smart inference (ported verbatim) ─────────────────────────────────────────
function inferEnergy(t: string): EnergyLevel | null {
  const l = t.toLowerCase();
  if (/write|design|plan|strategy|research|draft|architect|think/.test(l)) return 'high';
  if (/call|email|review|check|meet|discuss|schedule/.test(l)) return 'medium';
  if (/respond|forward|pay|buy|send|pick up|drop off/.test(l)) return 'low';
  return null;
}
function inferPriority(t: string): Priority | null {
  const l = t.toLowerCase();
  if (/urgent|asap|critical|important|emergency/.test(l)) return 'high';
  if (/whenever|eventually|no rush|someday|maybe/.test(l)) return 'low';
  return null;
}
function inferEstimate(t: string): number | null {
  const l = t.toLowerCase();
  if (/call|email|respond|forward|send|pay/.test(l)) return 15;
  if (/review|check|read|glance/.test(l)) return 30;
  if (/write|draft|design|plan/.test(l)) return 60;
  if (/research|deep dive|strategy|build/.test(l)) return 120;
  return null;
}

/** Local datetime value (YYYY-MM-DDTHH:mm) for the native picker. */
function toLocalInput(ts: number): string {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function TaskInput({
  onSubmit,
  placeholder,
  autoFocus,
  compact = false,
  defaultCategory,
  categories: catList,
}: TaskInputProps) {
  const { isDark } = useTheme();
  const [value, setValue] = useState('');
  const [category, setCategory] = useState(defaultCategory || 'personal');
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [priority, setPriority] = useState<Priority>('none');
  const [estimate, setEstimate] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [recurrence, setRecurrence] = useState<RecurringFrequency | null>(null);
  const [showTime, setShowTime] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [manual, setManual] = useState({ energy: false, priority: false, estimate: false });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultCategory) setCategory(defaultCategory);
  }, [defaultCategory]);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const showPills = value.trim().length > 0;

  const onText = (text: string) => {
    setValue(text);
    if (!manual.energy) { const e = inferEnergy(text); if (e) setEnergy(e); }
    if (!manual.priority) { const p = inferPriority(text); if (p) setPriority(p); }
    if (!manual.estimate) { const est = inferEstimate(text); if (est) setEstimate(est); }
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed, {
      energyLevel: energy,
      priority: priority !== 'none' ? priority : undefined,
      estimatedMinutes: estimate ?? undefined,
      deadline,
      category,
      isRecurring: recurrence != null,
      recurringFrequency: recurrence,
    });
    setValue('');
    setEnergy('medium');
    setPriority('none');
    setEstimate(null);
    setDeadline(null);
    setRecurrence(null);
    setCategory(defaultCategory || 'personal');
    setShowTime(false);
    setShowDeadline(false);
    setManual({ energy: false, priority: false, estimate: false });
    inputRef.current?.focus();
  };

  return (
    <motion.div
      layout
      style={
        showPills
          ? {
              background: 'var(--c-background-offwhite)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 8,
              boxShadow: '0 -3px 12px rgba(0,0,0,0.08)',
            }
          : undefined
      }
    >
      {showPills && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--c-gray200)' }} />
        </div>
      )}

      {/* Input row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--c-surface)',
          borderRadius: 'var(--r-input)',
          margin: '8px 16px',
          padding: '0 12px',
          height: 52,
          border: '1px solid var(--c-gray200)',
        }}
      >
        <Icon name="create-outline" size={20} color={value.trim() ? 'var(--c-text)' : 'var(--c-gray400)'} style={{ marginRight: 8 }} />
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder || 'What needs doing?'}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ flex: 1, height: '100%', fontSize: 16, background: 'transparent' }}
        />
        {showPills && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { haptic('light'); submit(); }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              background: 'var(--c-surface-dark)',
              color: 'var(--c-white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
              flexShrink: 0,
            }}
          >
            <Icon name="arrow-up" size={20} color="#fff" />
          </motion.button>
        )}
      </div>

      {/* Parameter pills */}
      <AnimatePresence>
        {showPills && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div className="tody-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 16px 8px' }}>
              <EnergyPill value={energy} onChange={(e) => { setEnergy(e); setManual((m) => ({ ...m, energy: true })); }} />
              <PriorityPill value={priority} onChange={(p) => { setPriority(p); setManual((m) => ({ ...m, priority: true })); }} />
              {catList && catList.length > 0 && <CategoryPill value={category} categories={catList} onChange={setCategory} />}
              <EstimatePill value={estimate} onPress={() => { setShowTime((v) => !v); setShowDeadline(false); }} />
              {!compact && <DeadlinePill value={deadline} onPress={() => { setShowDeadline((v) => !v); setShowTime(false); }} />}
              {!compact && <RecurrencePill value={recurrence} onChange={setRecurrence} />}
            </div>

            {showTime && (
              <TimeQuickPick
                value={estimate}
                onChange={(m) => { setEstimate(m); setManual((mm) => ({ ...mm, estimate: true })); }}
                onDone={() => setShowTime(false)}
              />
            )}

            {showDeadline && !compact && (
              <div style={{ padding: '0 16px 8px' }}>
                <DeadlineSnapper onSelectDeadline={(ts) => { setDeadline(ts); setShowDeadline(false); }} currentDeadline={deadline} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                  <input
                    type="datetime-local"
                    value={deadline ? toLocalInput(deadline) : ''}
                    onChange={(e) => {
                      const v = e.target.value ? new Date(e.target.value).getTime() : null;
                      setDeadline(v);
                    }}
                    style={{
                      flex: 1,
                      height: 34,
                      padding: '0 10px',
                      borderRadius: 8,
                      border: '1px solid var(--c-gray400)',
                      background: 'var(--c-gray50)',
                      color: 'var(--c-text)',
                      colorScheme: isDark ? 'dark' : 'light',
                      fontSize: 13,
                    }}
                  />
                  {deadline != null && (
                    <button onClick={() => { setDeadline(null); setShowDeadline(false); }}>
                      <Icon name="close-circle" size={20} color="var(--c-gray400)" />
                    </button>
                  )}
                  <button onClick={() => setShowDeadline(false)} style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 600 }}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
