/**
 * FriendsCard (Phase C) — the social entry point on the Profile screen.
 * Shows your weekly rank + the top few friends, and opens the full leaderboard.
 * When you have no friends yet, it becomes an invite CTA.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { useSocial } from './SocialContext';
import { InviteSheet } from './InviteSheet';

const cardStyle: React.CSSProperties = {
  background: 'var(--c-surface)',
  borderRadius: 'var(--r-card)',
  padding: 16,
  marginBottom: 16,
};

export function FriendsCard() {
  const navigate = useNavigate();
  const { leaderboard, myRank } = useSocial();
  const [inviteOpen, setInviteOpen] = useState(false);

  const hasFriends = leaderboard.some((r) => !r.is_self);
  const top = leaderboard.slice(0, 3);

  if (!hasFriends) {
    return (
      <>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--c-surface-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="people-outline" size={20} color="var(--c-white)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Compete with friends</div>
              <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 1 }}>Race on weekly XP and streaks.</div>
            </div>
            <Pressable onPress={() => setInviteOpen(true)} aria-label="Invite a friend" style={{ padding: '8px 14px', borderRadius: 'var(--r-pill)', background: 'var(--c-surface-dark)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-white)' }}>Invite</span>
            </Pressable>
          </div>
        </div>
        <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} kind="friend" />
      </>
    );
  }

  return (
    <Pressable onPress={() => navigate('/leaderboard')} hapticStyle="light" style={{ ...cardStyle, display: 'block', width: '100%', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>This week</div>
        {myRank != null && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-secondary)' }}>
            You're #{myRank}
          </div>
        )}
        <Icon name="chevron-forward" size={18} color="var(--c-text-tertiary)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {top.map((r) => (
          <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 18, fontSize: 13, fontWeight: 800, color: 'var(--c-text-tertiary)' }}>{r.rank}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: r.is_self ? 700 : 500, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.is_self ? 'You' : r.display_name}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{r.weekly_xp} XP</span>
          </div>
        ))}
      </div>
    </Pressable>
  );
}
