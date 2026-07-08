/**
 * PactDetailScreen (Phase E) — /pacts/:id. Full roster with per-participant
 * state, your own actions (accept/decline/leave/done), creator cancel, and a
 * share affordance.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { haptic } from '../../core/utils/haptics';
import { useAuth } from '../../core/context/AuthContext';
import { usePacts } from './PactContext';
import { PactProgressRing } from './PactProgressRing';
import { MemberAvatar } from '../collab/MemberAvatar';
import { InviteSheet } from '../social/InviteSheet';
import { pactProgress, myParticipation, type PactParticipantState } from './types';

const STATE_LABEL: Record<PactParticipantState, string> = {
  invited: 'Invited', accepted: 'In', done: 'Done', declined: 'Declined', left: 'Left',
};

export function PactDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPact, completeMyPart, acceptPact, declinePact, leavePact, cancelPact } = usePacts();
  const [shareOpen, setShareOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pact = id ? getPact(id) : undefined;

  if (!pact) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', paddingTop: 'var(--safe-top)' }}>
        <header style={{ padding: '12px 16px' }}>
          <Pressable onPress={() => navigate(-1)} aria-label="Back" style={{ padding: 4 }}><Icon name="chevron-down" size={26} /></Pressable>
        </header>
        <EmptyState title="Pact not found" subtitle="It may have been cancelled or you left it." icon="people-outline" />
      </div>
    );
  }

  const [done, total] = pactProgress(pact);
  const me = myParticipation(pact, user?.id);
  const isCreator = pact.creator_id === user?.id;
  const myDone = me?.state === 'done';

  const doDone = async () => {
    haptic('success');
    const res = await completeMyPart(pact.id);
    if (!res.ok) { setErr(res.error === 'offline' ? 'You need a connection to complete a pact.' : 'Could not complete. Try again.'); setTimeout(() => setErr(null), 2500); }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-background)', paddingTop: 'var(--safe-top)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 6px' }}>
        <Pressable onPress={() => navigate(-1)} aria-label="Back" style={{ padding: 4 }}><Icon name="chevron-down" size={26} /></Pressable>
        <h1 style={{ flex: 1, fontSize: 20, fontWeight: 700 }}>Pact</h1>
        <Pressable onPress={() => setShareOpen(true)} aria-label="Invite" style={{ padding: 6 }}><Icon name="people-outline" size={20} /></Pressable>
      </header>

      <div className="tody-scroll" style={{ flex: 1, minHeight: 0, padding: '8px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <PactProgressRing done={done} total={total} size={64} stroke={6} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{pact.title}</div>
            <div style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginTop: 2 }}>
              {pact.status === 'completed' ? 'Completed 🎉'
                : pact.status === 'expired' ? 'Expired'
                : pact.status === 'cancelled' ? 'Cancelled'
                : `${done} of ${total} done`}
            </div>
          </div>
        </div>

        {pact.description && (
          <p style={{ fontSize: 15, color: 'var(--c-text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>{pact.description}</p>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--c-text-tertiary)', marginBottom: 10 }}>Participants</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          {pact.participants.map((p) => (
            <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
              <MemberAvatar member={{ id: p.user_id, display_name: p.display_name, avatar_url: p.avatar_url, role: 'member' }} size={32} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>
                {p.user_id === user?.id ? 'You' : (p.display_name || 'Member')}
                {p.user_id === pact.creator_id && <span style={{ fontSize: 12, color: 'var(--c-text-tertiary)', marginLeft: 6 }}>· creator</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: p.state === 'done' ? '#22C55E' : 'var(--c-text-tertiary)' }}>
                {STATE_LABEL[p.state]}
              </span>
            </div>
          ))}
        </div>

        {err && <div style={{ fontSize: 13, color: '#e06767', marginBottom: 12, textAlign: 'center' }}>{err}</div>}

        {/* Actions */}
        {pact.status === 'active' && me && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {me.state === 'invited' && (
              <>
                <Button title="Join the pact" onPress={() => { haptic('medium'); void acceptPact(pact.id); }} />
                <Button title="Decline" variant="ghost" onPress={() => { void declinePact(pact.id); navigate(-1); }} />
              </>
            )}
            {(me.state === 'accepted') && (
              <Button title="Mark my part done" onPress={doDone} />
            )}
            {myDone && <Button title="Waiting on others…" variant="secondary" disabled onPress={() => {}} />}
            {(me.state === 'accepted' || me.state === 'invited') && !isCreator && (
              <Button title="Leave pact" variant="ghost" onPress={() => { void leavePact(pact.id); navigate(-1); }} />
            )}
          </div>
        )}
        {pact.status === 'active' && isCreator && (
          <Button title="Cancel pact" variant="ghost" onPress={() => { haptic('warning'); void cancelPact(pact.id); navigate(-1); }} />
        )}
      </div>

      <InviteSheet open={shareOpen} onClose={() => setShareOpen(false)} kind="pact" targetId={pact.id} title="Invite to your pact" />
    </div>
  );
}
