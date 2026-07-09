import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Task } from '../../core/types';
import { calculateUserStats, getRecentEstimatedTasks, hasEnoughDataForStats } from '../../core/utils/statsCalculation';
import { formatMinutes } from '../../core/utils/timeTracking';
import { useTheme } from '../../core/context/ThemeContext';

interface Props {
  tasks: Task[];         // active + archived
  currentStreak: number;
}

const CHART_W = 300;
const CHART_H = 90;

/**
 * Web port of native PerformanceFusionSection — the Profile "PERFORMANCE STORY":
 * a tone headline, momentum, hero score, estimate-vs-reality bars, and a pace
 * graph woven into prose. Uses the canonical reality-score formula (P1.5).
 */
export function PerformanceFusionSection({ tasks, currentStreak }: Props) {
  const { isDark } = useTheme();
  const stats = useMemo(() => calculateUserStats(tasks), [tasks]);
  const recent = useMemo(() => getRecentEstimatedTasks(tasks, 10), [tasks]);
  const hasData = useMemo(() => hasEnoughDataForStats(tasks), [tasks]);
  const progress = Math.min(100, Math.round((stats.totalCompletedTasks / 10) * 100));

  const scoreTone = !hasData
    ? 'Warming Up'
    : stats.realityScore >= 80 ? 'Calibrated'
    : stats.realityScore >= 55 ? 'Learning Curve'
    : 'Reality Drift';

  const momentum = currentStreak >= 7 ? 'Strong Rhythm' : currentStreak >= 3 ? 'Building Rhythm' : 'Early Momentum';

  const narrative = !hasData
    ? `Complete ${Math.max(0, 10 - stats.totalCompletedTasks)} more estimated tasks to unlock your full calibration score.`
    : stats.underestimationRate > 0 ? `You run optimistic by ${stats.underestimationRate}% on average.`
    : stats.underestimationRate < 0 ? `You budget generously by ${Math.abs(stats.underestimationRate)}% on average.`
    : 'Your estimates are tightly aligned with reality.';

  const alignmentMax = Math.max(stats.totalEstimatedMinutes, stats.totalActualMinutes, 1);
  const estW = `${Math.round((stats.totalEstimatedMinutes / alignmentMax) * 100)}%`;
  const actW = `${Math.round((stats.totalActualMinutes / alignmentMax) * 100)}%`;

  const chart = useMemo(() => {
    if (recent.length < 2) return null;
    const ordered = [...recent].reverse();
    const max = Math.max(...ordered.map((t) => Math.max(t.estimatedMinutes || 0, t.actualMinutes || 0)), 1);
    const pts = ordered.map((t, i) => ({
      x: (i / (ordered.length - 1)) * CHART_W,
      ey: CHART_H - ((t.estimatedMinutes || 0) / max) * CHART_H,
      ay: CHART_H - ((t.actualMinutes || 0) / max) * CHART_H,
    }));
    return {
      estimated: pts.map((p) => `${p.x},${p.ey}`).join(' '),
      actual: pts.map((p) => `${p.x},${p.ay}`).join(' '),
    };
  }, [recent]);

  const estColor = isDark ? '#555' : '#D1D5DB';
  const card: React.CSSProperties = {
    margin: '0 24px 20px', background: 'var(--c-surface)', borderRadius: 'var(--r-card)',
    border: '1px solid var(--c-border-light)', padding: 18,
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--c-text-tertiary)', padding: '4px 24px 12px' }}>
        PERFORMANCE STORY
      </div>
      <div style={card}>
        {/* Hero */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>
              Your operating pattern
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', margin: '2px 0 4px' }}>{scoreTone}</div>
            <div style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>{momentum}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-1px' }}>{hasData ? stats.realityScore : progress}</span>
            <span style={{ fontSize: 14, color: 'var(--c-text-tertiary)', marginLeft: 2 }}>{hasData ? '%' : '% ready'}</span>
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.5, marginBottom: hasData ? 16 : 0 }}>{narrative}</p>

        {hasData && (
          <>
            {/* Estimate vs reality bars */}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', color: 'var(--c-text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
              Estimate vs reality
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <BarRow label="Estimated" value={formatMinutes(stats.totalEstimatedMinutes)} width={estW} color={estColor} />
              <BarRow label="Actual" value={formatMinutes(stats.totalActualMinutes)} width={actW} color={isDark ? '#fff' : '#000'} />
            </div>

            {/* Pace graph */}
            {chart && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', color: 'var(--c-text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Pace · last {recent.length}
                </div>
                <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: CHART_H, overflow: 'visible' }}>
                  <polyline points={chart.estimated} fill="none" stroke={estColor} strokeWidth={1.5} />
                  <polyline points={chart.actual} fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth={1.5} />
                </svg>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BarRow({ label, value, width, color }: { label: string; value: string; width: string; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--c-text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--c-gray200)', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width }} transition={{ type: 'spring', damping: 20, stiffness: 260 }} style={{ height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}
