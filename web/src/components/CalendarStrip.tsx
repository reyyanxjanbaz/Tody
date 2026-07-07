import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { startOfDay, addDays } from '../core/utils/dateUtils';
import { haptic } from '../core/utils/haptics';

const PAST = 14;
const FUTURE = 14;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarStrip({ selectedDate, onDateChange }: { selectedDate: number; onDateChange: (ts: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => {
    const today = startOfDay();
    const arr = [];
    for (let i = -PAST; i <= FUTURE; i++) {
      const d = addDays(today, i);
      arr.push({ key: d.toISOString().slice(0, 10), ts: d.getTime(), label: DAY_LABELS[d.getDay()], num: d.getDate(), isToday: i === 0 });
    }
    return arr;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const idx = days.findIndex((d) => d.ts === selectedDate);
      const target = (idx >= 0 ? idx : PAST) * 56 - el.clientWidth / 2 + 28;
      el.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scrollRef} className="tody-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 16px' }}>
      {days.map((d) => {
        const selected = d.ts === selectedDate;
        return (
          <motion.button
            key={d.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => { haptic('light'); onDateChange(d.ts); }}
            style={{
              flexShrink: 0,
              width: 48,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 0',
              borderRadius: 'var(--r-button)',
              background: selected ? 'var(--c-text)' : 'transparent',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.3px', color: selected ? 'var(--c-background)' : d.isToday ? 'var(--c-text-secondary)' : 'var(--c-text-tertiary)', marginBottom: 4 }}>
              {d.label}
            </span>
            <span style={{ fontSize: 18, fontWeight: selected || d.isToday ? 700 : 600, color: selected ? 'var(--c-background)' : 'var(--c-text)' }}>{d.num}</span>
            {d.isToday && !selected && <span style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--c-text)', marginTop: 4 }} />}
          </motion.button>
        );
      })}
    </div>
  );
}
