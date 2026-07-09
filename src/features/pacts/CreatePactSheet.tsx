/**
 * CreatePactSheet (Phase E) — name a pact, create it, then share the invite so
 * others can join. The creator is a participant automatically.
 */
import { useState } from 'react';
import { Sheet } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { haptic } from '../../core/utils/haptics';
import { usePacts } from './PactContext';
import { InviteSheet } from '../social/InviteSheet';
import { maybePromptPush } from '../../core/lib/push';

export function CreatePactSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createPact } = usePacts();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharePactId, setSharePactId] = useState<string | null>(null);

  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    haptic('success');
    setBusy(true);
    const pact = await createPact({ title: t });
    setBusy(false);
    setTitle('');
    onClose();
    if (pact) {
      void maybePromptPush(); // opt into pact notifications at a high-intent moment
      setSharePactId(pact.id); // immediately offer to invite others
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}>New pact</h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', textAlign: 'center', marginTop: -6 }}>
            Everyone invited has to finish for the pact to complete.
          </p>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            placeholder="e.g. Ship the beta this week"
            style={{ height: 48, borderRadius: 12, padding: '0 14px', background: 'var(--c-gray100)', color: 'var(--c-text)', fontSize: 16 }}
          />
          <Button title={busy ? 'Creating…' : 'Create & invite'} onPress={submit} disabled={!title.trim() || busy} />
        </div>
      </Sheet>

      <InviteSheet
        open={sharePactId != null}
        onClose={() => setSharePactId(null)}
        kind="pact"
        targetId={sharePactId ?? undefined}
        title="Invite to your pact"
        subtitle="They join, and the pact completes only when everyone's done."
      />
    </>
  );
}
