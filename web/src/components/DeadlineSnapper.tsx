import { useMemo } from 'react';
import { Icon } from '../ui/Icon';

interface QuickChip {
  label: string;
  icon: string;
  iconColor: string;
  ts: number;
}

/** Web port of components/DeadlineSnapper — magnetic quick-set deadline chips. */
export function DeadlineSnapper({
  onSelectDeadline,
  currentDeadline,
}: {
  onSelectDeadline: (ts: number) => void;
  currentDeadline: number | null;
}) {
  const chips = useMemo<QuickChip[]>(() => {
    const now = new Date();
    const at = (addDays: number, h: number, m = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + addDays);
      d.setHours(h, m, 0, 0);
      return d.getTime();
    };
    const out: QuickChip[] = [];
    if (now.getHours() < 9) out.push({ label: 'Today 9 AM', icon: 'sunny-outline', iconColor: '#F59E0B', ts: at(0, 9) });
    if (now.getHours() < 12) out.push({ label: 'Noon', icon: 'sunny', iconColor: '#F59E0B', ts: at(0, 12) });
    if (now.getHours() < 17) out.push({ label: 'Today 5 PM', icon: 'time-outline', iconColor: '#EF4444', ts: at(0, 17) });
    out.push({ label: 'End of Day', icon: 'moon-outline', iconColor: '#EF4444', ts: at(0, 23, 59) });
    out.push({ label: 'Tomorrow 9 AM', icon: 'arrow-forward-circle-outline', iconColor: '#22C55E', ts: at(1, 9) });
    out.push({ label: 'Tomorrow 5 PM', icon: 'arrow-forward-outline', iconColor: '#F59E0B', ts: at(1, 17) });

    const sat = new Date(now);
    const dSat = (6 - sat.getDay() + 7) % 7 || 7;
    out.push({ label: 'This Weekend', icon: 'cafe-outline', iconColor: '#22C55E', ts: at(dSat, 10) });

    const mon = new Date(now);
    const dMon = mon.getDay() === 0 ? 1 : 8 - mon.getDay();
    out.push({ label: 'Next Monday', icon: 'calendar-outline', iconColor: '#22C55E', ts: at(dMon, 9) });
    return out;
  }, []);

  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', color: 'var(--c-gray500)', marginBottom: 8 }}>
        QUICK SET
      </div>
      <div className="tody-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {chips.map((chip, i) => {
          const selected = currentDeadline != null && Math.abs(chip.ts - currentDeadline) < 60000;
          return (
            <button
              key={i}
              onClick={() => onSelectDeadline(chip.ts)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 10px',
                borderRadius: 14,
                border: `1px solid ${selected ? 'var(--c-text)' : 'var(--c-gray400)'}`,
                background: selected ? 'var(--c-text)' : 'var(--c-surface)',
                color: selected ? 'var(--c-background)' : 'var(--c-text)',
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Icon name={chip.icon} size={13} color={selected ? 'var(--c-background)' : chip.iconColor} />
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
