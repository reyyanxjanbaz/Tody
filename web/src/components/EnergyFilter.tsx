import { motion } from 'framer-motion';
import { Icon } from '../ui/Icon';
import { haptic } from '../core/utils/haptics';
import type { EnergyLevel } from '../core/types';

interface Props {
  value: EnergyLevel | null;
  onChange: (v: EnergyLevel | null) => void;
}

const LEVELS: { level: EnergyLevel; label: string; color: string }[] = [
  { level: 'high',   label: 'Deep focus', color: '#EF4444' },
  { level: 'medium', label: 'Medium',     color: '#F59E0B' },
  { level: 'low',    label: 'Low lift',   color: '#22C55E' },
];

/**
 * Phase 3.3 — Energy filter. Every task carries an energy level but there was
 * never a way to ask "what can I do *right now*?". These ⚡ chips let the user
 * match tasks to their current capacity — single-select and session-only
 * (capacity fluctuates through the day; a sticky filter would be a trap).
 */
export function EnergyFilter({ value, onChange }: Props) {
  return (
    <div className="tody-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 16px 4px' }}>
      {LEVELS.map(({ level, label, color }) => {
        const active = value === level;
        return (
          <motion.button
            key={level}
            whileTap={{ scale: 0.94 }}
            aria-pressed={active}
            aria-label={`Filter by ${label} energy`}
            onClick={() => { haptic('selection'); onChange(active ? null : level); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 32, padding: '0 12px', borderRadius: 16, flexShrink: 0,
              border: `1px solid ${active ? color : 'var(--c-gray200)'}`,
              background: active ? `${color}1a` : 'var(--c-gray50)',
              color: active ? color : 'var(--c-gray500)',
              fontSize: 13, fontWeight: active ? 700 : 500,
            }}
          >
            <Icon name="flash" size={13} color={active ? color : 'var(--c-gray400)'} />
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
