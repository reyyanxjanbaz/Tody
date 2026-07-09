import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';
import { loadSwipeStats, type SwipeAction } from '../../core/utils/swipeMemory';

/**
 * Phase 3.2 — "Your quick actions". Swipe Action Memory used to track counts
 * that nothing ever read (the get*SwipeOrder helpers had zero consumers). We
 * deliberately do NOT adaptively reorder the swipe rails — moving a muscle-
 * memory target is anti-calm for ND users. Instead the data becomes gentle
 * self-insight: a ranked view of how you actually clear your list.
 */

const ACTION_META: Record<SwipeAction, { label: string; icon: string; color: string }> = {
  complete: { label: 'Completed', icon: 'checkmark-circle', color: '#22C55E' },
  defer:    { label: 'Snoozed',   icon: 'time-outline',      color: '#F59E0B' },
  start:    { label: 'Started',   icon: 'play-circle',       color: '#3B82F6' },
  subtask:  { label: 'Broke down', icon: 'git-branch-outline', color: '#8B5CF6' },
  revive:   { label: 'Revived',   icon: 'sparkles-outline',  color: '#EC4899' },
  delete:   { label: 'Deleted',   icon: 'trash-outline',     color: '#EF4444' },
};

const MIN_SWIPES = 8;

export function SwipeHabitsSection() {
  const [rows, setRows] = useState<Array<{ action: SwipeAction; count: number }>>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    loadSwipeStats().then((stats) => {
      if (!alive) return;
      const ordered = (Object.keys(stats.counts) as SwipeAction[])
        .map((action) => ({ action, count: stats.counts[action] || 0 }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count);
      setRows(ordered);
      setTotal(stats.totalSwipes);
    });
    return () => { alive = false; };
  }, []);

  // Not enough signal yet — stay quiet rather than show a lonely 1-bar chart.
  if (total < MIN_SWIPES || rows.length === 0) return null;

  const max = rows[0].count || 1;
  const top = rows[0];

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', color: 'var(--c-text-tertiary)', padding: '4px 24px 12px' }}>
        YOUR QUICK ACTIONS
      </div>
      <div style={{ margin: '0 24px 20px', background: 'var(--c-surface)', borderRadius: 'var(--r-card)', border: '1px solid var(--c-border-light)', padding: 18 }}>
        <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
          Mostly you <strong style={{ color: ACTION_META[top.action].color }}>{ACTION_META[top.action].label.toLowerCase()}</strong> your way through the day.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => {
            const m = ACTION_META[r.action];
            return (
              <div key={r.action} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name={m.icon} size={16} color={m.color} />
                <span style={{ width: 78, fontSize: 13, color: 'var(--c-text-secondary)' }}>{m.label}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--c-gray200)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((r.count / max) * 100)}%` }}
                    transition={{ type: 'spring', damping: 22, stiffness: 260, delay: 0.04 * i }}
                    style={{ height: '100%', background: m.color, borderRadius: 3 }}
                  />
                </div>
                <span style={{ width: 30, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{r.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
