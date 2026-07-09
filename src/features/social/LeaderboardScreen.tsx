/**
 * LeaderboardScreen (Phase C) — weekly friend leaderboard.
 *
 * Rows animate on re-rank via `layout`. Own row is highlighted. Shows an "as of"
 * stamp when displaying a cached snapshot (online-only data).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { EmptyState } from '../../ui/EmptyState';
import { Spinner } from '../../ui/Spinner';
import { SPRING_LAYOUT } from '../../theme/motion';
import { useSocial } from './SocialContext';
import { InviteSheet } from './InviteSheet';

function relativeTime(at: number | null): string {
  if (!at) return '';
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const MEDAL = ['#F4C430', '#B8C4CE', '#CD7F32']; // gold / silver / bronze

export function LeaderboardScreen() {
  const navigate = useNavigate();
  const { leaderboard, leaderboardAt, isLoading, refresh } = useSocial();
  const [inviteOpen, setInviteOpen] = useState(false);

  const hasFriends = leaderboard.some((r) => !r.is_self);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', paddingTop: 'var(--safe-top)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 6px' }}>
        <Pressable onPress={() => navigate(-1)} aria-label="Back" style={{ padding: 4 }}>
          <Icon name="chevron-down" size={26} />
        </Pressable>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' }}>This week</h1>
          {leaderboardAt && (
            <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>Updated {relativeTime(leaderboardAt)}</span>
          )}
        </div>
        <Pressable onPress={() => refresh()} aria-label="Refresh" style={{ padding: 6 }}>
          {isLoading ? <Spinner size={18} color="var(--c-text-secondary)" /> : <Icon name="refresh-outline" size={20} />}
        </Pressable>
        <Pressable onPress={() => setInviteOpen(true)} aria-label="Invite a friend" style={{ padding: 6 }}>
          <Icon name="people-outline" size={20} />
        </Pressable>
      </header>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, padding: '8px 12px' }}>
        {!hasFriends ? (
          <EmptyState
            title="No friends yet"
            subtitle="Invite someone who actually uses Tody and race on weekly XP."
            icon="people-outline"
          />
        ) : (
          leaderboard.map((row) => (
            <motion.div
              key={row.user_id}
              layout
              transition={SPRING_LAYOUT}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                marginBottom: 8,
                borderRadius: 14,
                background: row.is_self ? 'var(--c-gray50)' : 'transparent',
                border: row.is_self ? '1px solid var(--c-border)' : '1px solid transparent',
              }}
            >
              <span style={{ width: 26, textAlign: 'center', fontSize: 15, fontWeight: 800, color: MEDAL[row.rank - 1] ?? 'var(--c-text-tertiary)' }}>
                {row.rank}
              </span>
              <span style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0, overflow: 'hidden', background: 'var(--c-gray100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-secondary)' }}>
                    {(row.display_name || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.is_self ? 'You' : row.display_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)' }}>{row.tasks_completed} done</div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)' }}>{row.weekly_xp}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-tertiary)', marginLeft: 2 }}>XP</span></span>
            </motion.div>
          ))
        )}
      </div>

      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} kind="friend" />
    </div>
  );
}
