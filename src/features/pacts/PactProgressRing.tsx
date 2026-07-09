/** PactProgressRing (Phase E) — a ring split into one segment per quorum
 *  participant; filled segments = done. Center shows "done/total". */
import { SPRING_LAYOUT } from '../../theme/motion';
import { motion } from 'framer-motion';

interface Props {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
}

export function PactProgressRing({ done, total, size = 44, stroke = 4 }: Props) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 1 ? 6 : 0; // px gap between segments
  const segLen = total > 0 ? circumference / total - gap : circumference;

  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {Array.from({ length: Math.max(total, 1) }).map((_, i) => {
          const offset = -(i * (segLen + gap));
          const filled = i < done;
          return (
            <motion.circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={filled ? 'var(--c-text)' : 'var(--c-gray200)'}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(segLen, 0.001)} ${circumference}`}
              strokeDashoffset={offset}
              initial={false}
              animate={{ stroke: filled ? 'var(--c-text)' : 'var(--c-gray200)' }}
              transition={SPRING_LAYOUT}
            />
          );
        })}
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.28, fontWeight: 800, color: 'var(--c-text)' }}>
        {done}/{total}
      </span>
    </span>
  );
}
