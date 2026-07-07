import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';

interface Props {
  streak: number;
  size?: number;
  /** Dim the flame when today's obligation is still open (streak "at risk"). */
  atRisk?: boolean;
}

/** Flame colour warms as the streak grows — a small, earned sense of heat. */
function flameColor(streak: number): string {
  if (streak >= 100) return '#8B5CF6'; // legendary
  if (streak >= 30) return '#EF4444';  // hot
  if (streak >= 7) return '#F97316';   // warm
  return '#F59E0B';                    // starting
}

/**
 * Phase 5 — 🔥 streak badge. The number is the whole point of classic streaks,
 * so it's front and centre; a milestone pulse marks 7/30/100.
 */
export function StreakFlame({ streak, size = 15, atRisk = false }: Props) {
  const color = flameColor(streak);
  const milestone = streak === 7 || streak === 30 || streak === 100;
  return (
    <motion.span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, opacity: atRisk ? 0.55 : 1 }}
      animate={milestone ? { scale: [1, 1.25, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Icon name={streak > 0 ? 'flame' : 'flame-outline'} size={size} color={streak > 0 ? color : 'var(--c-gray400)'} />
      <span style={{ fontSize: size - 1, fontWeight: 700, color: streak > 0 ? color : 'var(--c-gray400)' }}>{streak}</span>
    </motion.span>
  );
}
