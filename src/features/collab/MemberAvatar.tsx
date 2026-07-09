/** MemberAvatar (Phase D) — small round avatar (photo or initial). */
import type { Member } from './CollabContext';

export function MemberAvatar({ member, size = 18 }: { member?: Member | null; size?: number }) {
  const initial = (member?.display_name || '?').slice(0, 1).toUpperCase();
  return (
    <span
      title={member?.display_name ?? undefined}
      style={{
        width: size, height: size, borderRadius: size / 2, flexShrink: 0, overflow: 'hidden',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--c-gray200)',
      }}
    >
      {member?.avatar_url ? (
        <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: size * 0.5, fontWeight: 700, color: 'var(--c-text-secondary)' }}>{initial}</span>
      )}
    </span>
  );
}
