/**
 * FriendsCard (Phase C) — the social entry point on the Profile screen.
 *
 * A single tappable card that opens the Social hub (/social), where friends,
 * the weekly leaderboard, pacts, and workspace sharing all live. Shows a glance
 * of your weekly rank + top friends when you have them, or an invite prompt when
 * you don't.
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { useSocial } from './SocialContext';

const cardStyle: React.CSSProperties = {
  background: 'var(--c-surface)',
  borderRadius: 'var(--r-card)',
  padding: 16,
  marginBottom: 16,
  display: 'block',
  width: '100%',
  textAlign: 'left',
};

export function FriendsCard() {
  const navigate = useNavigate();
  const { leaderboard, myRank } = useSocial();

  const hasFriends = leaderboard.some((r) => !r.is_self);
  const top = leaderboard.slice(0, 3);

  return (
    <Pressable onPress={() => navigate('/social')} hapticStyle="light" style={cardStyle}>
      {!hasFriends ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--c-surface-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="people-outline" size={20} color="var(--c-white)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Friends &amp; Pacts</div>
            <div style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginTop: 1 }}>Invite friends, race on weekly XP, make pacts.</div>
          </div>
          <Icon name="chevron-forward" size={18} color="var(--c-text-tertiary)" />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Friends &amp; Pacts</div>
            {myRank != null && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-secondary)', marginRight: 4 }}>
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
        </>
      )}
    </Pressable>
  );
}
