/**
 * PactCard (Phase E) — a pact rendered in the Home "Pacts" band. Distinct from a
 * task row: bordered card, participant avatars, progress ring, and a "mark my
 * part done" affordance (online-required).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';
import { Pressable } from '../../ui/Pressable';
import { haptic } from '../../core/utils/haptics';
import { SPRING_BOUNCY } from '../../theme/motion';
import { useOnline } from '../../utils/useOnline';
import { useAuth } from '../../core/context/AuthContext';
import { usePacts } from './PactContext';
import { PactProgressRing } from './PactProgressRing';
import { MemberAvatar } from '../collab/MemberAvatar';
import { pactProgress, myParticipation, type Pact } from './types';

export function PactCard({ pact }: { pact: Pact }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { completeMyPart } = usePacts();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [done, total] = pactProgress(pact);
  const me = myParticipation(pact, user?.id);
  const myDone = me?.state === 'done';
  const online = useOnline();

  const markDone = async () => {
    if (busy || myDone) return;
    if (!online) { setErr('needs connection'); setTimeout(() => setErr(null), 2000); return; }
    haptic('success');
    setBusy(true);
    const res = await completeMyPart(pact.id);
    setBusy(false);
    if (!res.ok) { setErr(res.error === 'offline' ? 'needs connection' : 'try again'); setTimeout(() => setErr(null), 2000); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_BOUNCY}
      style={{
        margin: '0 16px 10px',
        padding: 14,
        borderRadius: 16,
        border: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Pressable onPress={() => navigate(`/pacts/${pact.id}`)} hapticStyle={null} style={{ background: 'transparent', padding: 0 }} aria-label="Open pact">
        <PactProgressRing done={done} total={total} />
      </Pressable>

      <div style={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/pacts/${pact.id}`)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="people-outline" size={13} color="var(--c-text-tertiary)" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--c-text-tertiary)' }}>Pact</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {pact.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
          {pact.participants.slice(0, 4).map((p, i) => (
            <span key={p.user_id} style={{ marginLeft: i === 0 ? 0 : -6, opacity: p.state === 'done' ? 1 : 0.55, border: '1.5px solid var(--c-surface)', borderRadius: 999 }}>
              <MemberAvatar member={{ id: p.user_id, display_name: p.display_name, avatar_url: p.avatar_url, role: 'member' }} size={20} />
            </span>
          ))}
        </div>
      </div>

      {pact.status === 'completed' ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22C55E', fontSize: 13, fontWeight: 700 }}>
          <Icon name="checkmark-circle" size={18} color="#22C55E" /> Done
        </span>
      ) : (
        <Pressable
          onPress={markDone}
          disabled={busy || myDone}
          hapticStyle={null}
          aria-label={myDone ? 'Your part is done' : 'Mark my part done'}
          style={{
            padding: '8px 14px', borderRadius: 'var(--r-pill)',
            background: myDone ? 'var(--c-gray100)' : 'var(--c-surface-dark)',
            opacity: online ? 1 : 0.6,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: myDone ? 'var(--c-text-tertiary)' : 'var(--c-white)' }}>
            {err ?? (myDone ? 'Waiting…' : 'Done')}
          </span>
        </Pressable>
      )}
    </motion.div>
  );
}
