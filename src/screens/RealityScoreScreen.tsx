import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../core/context/TaskContext';
import { useTheme } from '../core/context/ThemeContext';
import { calculateUserStats, getRecentEstimatedTasks, hasEnoughDataForStats } from '../core/utils/statsCalculation';
import { formatMinutes } from '../core/utils/timeTracking';
import { api } from '../core/lib/api';
import { Icon } from '../ui/Icon';
import { Pressable } from '../ui/Pressable';

type BackendRealityScore = {
  reality_score: number;
  underestimation_rate: number;
  total_estimated_minutes: number;
  total_actual_minutes: number;
  recent_tasks: Array<{ estimated_minutes: number; actual_minutes: number }>;
};

const CHART_W = 320;
const CHART_H = 160;

function isValidRealityPayload(data: unknown): data is BackendRealityScore {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.reality_score === 'number' && Array.isArray(d.recent_tasks);
}

export function RealityScoreScreen() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { tasks, archivedTasks } = useTasks();
  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);

  const localStats = useMemo(() => calculateUserStats(allTasks), [allTasks]);
  const localRecent = useMemo(() => getRecentEstimatedTasks(allTasks, 10), [allTasks]);
  const hasEnough = useMemo(() => hasEnoughDataForStats(allTasks), [allTasks]);

  const [backend, setBackend] = useState<BackendRealityScore | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.get<BackendRealityScore>('/profile/reality-score').then(({ data }) => {
      // Only trust a fully-shaped payload — a truthy-but-incomplete response
      // (missing recent_tasks / non-numeric score) previously crashed the
      // screen at `backend.recent_tasks.slice`. On anything malformed we fall
      // through to local stats.
      if (!cancelled && isValidRealityPayload(data)) setBackend(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const stats = backend
    ? { realityScore: backend.reality_score, underestimationRate: backend.underestimation_rate, totalEstimatedMinutes: backend.total_estimated_minutes, totalActualMinutes: backend.total_actual_minutes, totalCompletedTasks: localStats.totalCompletedTasks }
    : { realityScore: localStats.realityScore, underestimationRate: localStats.underestimationRate, totalEstimatedMinutes: localStats.totalEstimatedMinutes, totalActualMinutes: localStats.totalActualMinutes, totalCompletedTasks: localStats.totalCompletedTasks };

  const recent = backend ? backend.recent_tasks.slice(0, 10).map((r) => ({ estimatedMinutes: r.estimated_minutes, actualMinutes: r.actual_minutes })) : localRecent;

  const chart = useMemo(() => {
    if (recent.length < 2) return null;
    const ordered = [...recent].reverse();
    const max = Math.max(...ordered.map((t) => Math.max(t.estimatedMinutes || 0, t.actualMinutes || 0)));
    if (max === 0) return null;
    const pts = ordered.map((t, i) => ({
      x: (i / (ordered.length - 1)) * CHART_W,
      ey: CHART_H - ((t.estimatedMinutes || 0) / max) * CHART_H,
      ay: CHART_H - ((t.actualMinutes || 0) / max) * CHART_H,
    }));
    return {
      estimated: pts.map((p) => `${p.x},${p.ey}`).join(' '),
      actual: pts.map((p) => `${p.x},${p.ay}`).join(' '),
      pts,
    };
  }, [recent]);

  const estColor = isDark ? '#555555' : '#D1D5DB';

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', color: 'var(--c-text)' }}>
      <div style={{ padding: 'calc(var(--safe-top) + 12px) 20px 8px' }}>
        <Pressable onPress={() => navigate(-1)} style={{ padding: 4 }}><Icon name="chevron-back" size={26} /></Pressable>
      </div>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, padding: '20px 16px calc(var(--safe-bottom) + 20px)' }}>
        {!hasEnough ? (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Not enough data yet</div>
            <div style={{ fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.5, padding: '0 24px' }}>
              Complete at least 10 tasks with time estimates to see your Reality Score.
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-text-tertiary)', marginTop: 20 }}>{stats.totalCompletedTasks} of 10 tasks completed</div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-2px' }}>{stats.realityScore}%</div>
              <div style={{ fontSize: 14, color: 'var(--c-text-secondary)', marginTop: 4 }}>estimate accuracy</div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 32, fontSize: 16, color: 'var(--c-text-secondary)' }}>
              {stats.underestimationRate > 0
                ? `You typically underestimate by ${stats.underestimationRate}%`
                : stats.underestimationRate < 0
                ? `You typically overestimate by ${Math.abs(stats.underestimationRate)}%`
                : 'Your estimates are spot on!'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 32 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{formatMinutes(stats.totalEstimatedMinutes)}</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-secondary)', marginTop: 4 }}>estimated</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{formatMinutes(stats.totalActualMinutes)}</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-secondary)', marginTop: 4 }}>actual</div>
              </div>
            </div>

            {chart && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', color: 'var(--c-text-tertiary)', textAlign: 'center', marginBottom: 16 }}>
                  LAST {recent.length} TASKS
                </div>
                <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: CHART_H, overflow: 'visible' }}>
                  <polyline points={chart.estimated} fill="none" stroke={estColor} strokeWidth={1.5} />
                  <polyline points={chart.actual} fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth={1.5} />
                  {chart.pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.ey} r={3} fill={estColor} />
                      <circle cx={p.x} cy={p.ay} r={3} fill={isDark ? '#fff' : '#000'} />
                    </g>
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--c-text-secondary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: isDark ? '#fff' : '#000' }} /> Actual
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--c-text-secondary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: estColor }} /> Estimated
                  </span>
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--c-text-tertiary)', textAlign: 'center', marginTop: 16 }}>
              Based on {stats.totalCompletedTasks} tasks with estimates
            </div>
          </>
        )}
      </div>
    </div>
  );
}
